#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { ItemApiStack } from '../lib/item-api-stack.js';
import { getConfig } from '../lib/config.js';

const app = new App();

// cdk synth -c env=prod
const config = getConfig(app.node.tryGetContext('env'));

new ItemApiStack(app, `ItemApi-${config.envName}`, {
  config,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
  },
  description: `Exam item management API (${config.envName})`,
});
