import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { fileURLToPath } from 'url';
import * as path from 'path';
import { EnvConfig } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LAMBDA_ENTRY = path.join(__dirname, '../../src/lambda.ts');

export interface ItemApiStackProps extends StackProps {
  config: EnvConfig;
}

export class ItemApiStack extends Stack {
  constructor(scope: Construct, id: string, props: ItemApiStackProps) {
    super(scope, id, props);
    const { config } = props;

    // ---------------------------------------------------------------------------
    // DynamoDB - single table. LATEST record + one VERSION# record per version,
    // two sparse GSIs for listing. See ARCHITECTURE.md / src/storage/dynamodb.ts
    // ---------------------------------------------------------------------------
    const table = new dynamodb.Table(this, 'ItemsTable', {
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      // On-demand: traffic is spiky (authoring sessions, bulk imports) and low overall,
      // so no capacity planning needed. Revisit if traffic becomes steady.
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    // List by subject (optionally narrowed by status via begins_with on the SK)
    table.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL, // list returns full items, avoids N extra GetItems
    });

    // List by status (e.g. review queue)
    table.addGlobalSecondaryIndex({
      indexName: 'GSI2',
      partitionKey: { name: 'GSI2PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI2SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // ---------------------------------------------------------------------------
    // Lambda - one function per route, all built from the same entry file.
    // Separate functions = separate IAM roles, log groups and metrics, at the cost
    // of more cold starts than a single "lambdalith".
    // ---------------------------------------------------------------------------
    const makeFunction = (name: string, handler: string, access: 'read' | 'write') => {
      const logGroup = new logs.LogGroup(this, `${name}Logs`, {
        retention: config.logRetention,
      });

      const fn = new NodejsFunction(this, name, {
        entry: LAMBDA_ENTRY,
        handler,
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64, // cheaper, no native deps to worry about
        memorySize: config.lambdaMemoryMb,
        timeout: config.lambdaTimeout,
        // reservedConcurrentExecutions: 10, // revisit once we know real traffic
        logGroup,
        environment: {
          USE_DYNAMODB: 'true',
          DYNAMODB_TABLE_NAME: table.tableName,
          LOG_LEVEL: config.logLevel,
          NODE_OPTIONS: '--enable-source-maps',
        },
        bundling: {
          minify: true,
          sourceMap: true,
          // ESM output to match the source ("type": "module"). Banner shims `require`
          // for any CJS deps esbuild inlines (zod/uuid are fine, but the SDK isn't bundled anyway)
          format: OutputFormat.ESM,
          mainFields: ['module', 'main'],
          banner: "import { createRequire } from 'module';const require = createRequire(import.meta.url);",
          // AWS SDK v3 is included in the Node 22 runtime
          externalModules: ['@aws-sdk/*'],
        },
      });

      // Read-only routes don't get write access to the table
      if (access === 'read') {
        table.grantReadData(fn);
      } else {
        table.grantReadWriteData(fn);
      }

      return fn;
    };

    const fns = {
      createItem: makeFunction('CreateItemFn', 'createItem', 'write'),
      getItem: makeFunction('GetItemFn', 'getItem', 'read'),
      updateItem: makeFunction('UpdateItemFn', 'updateItem', 'write'),
      listItems: makeFunction('ListItemsFn', 'listItems', 'read'),
      createVersion: makeFunction('CreateVersionFn', 'createVersion', 'write'),
      getAuditTrail: makeFunction('GetAuditTrailFn', 'getAuditTrail', 'read'),
    };

    // ---------------------------------------------------------------------------
    // API Gateway REST API with Lambda proxy integrations
    // ---------------------------------------------------------------------------
    const api = new apigw.RestApi(this, 'ItemsApi', {
      restApiName: `item-api-${config.envName}`,
      cloudWatchRole: true, // needed for API Gateway execution logs
      deployOptions: {
        stageName: config.envName,
        loggingLevel: config.apiLoggingLevel,
        dataTraceEnabled: false, // would log request bodies (exam content)
      },
      defaultCorsPreflightOptions: {
        // TODO: restrict to the authoring UI origin once we have one
        allowOrigins: apigw.Cors.ALL_ORIGINS,
        allowMethods: ['GET', 'POST', 'PUT', 'OPTIONS'],
      },
    });

    const integration = (fn: lambda.IFunction) => new apigw.LambdaIntegration(fn);

    // /api/items
    const items = api.root.addResource('api').addResource('items');
    items.addMethod('POST', integration(fns.createItem));
    items.addMethod('GET', integration(fns.listItems));

    // /api/items/{id}
    const item = items.addResource('{id}');
    item.addMethod('GET', integration(fns.getItem));
    item.addMethod('PUT', integration(fns.updateItem));

    // /api/items/{id}/versions + /api/items/{id}/audit
    item.addResource('versions').addMethod('POST', integration(fns.createVersion));
    item.addResource('audit').addMethod('GET', integration(fns.getAuditTrail));

    new CfnOutput(this, 'ApiUrl', { value: api.url });
    new CfnOutput(this, 'TableName', { value: table.tableName });
  }
}
