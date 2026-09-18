import { Duration } from 'aws-cdk-lib';
import { MethodLoggingLevel } from 'aws-cdk-lib/aws-apigateway';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';

export type EnvName = 'dev' | 'prod';

export interface EnvConfig {
  envName: EnvName;
  logRetention: RetentionDays;
  lambdaMemoryMb: number;
  lambdaTimeout: Duration;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  apiLoggingLevel: MethodLoggingLevel;
}

const configs: Record<EnvName, EnvConfig> = {
  dev: {
    envName: 'dev',
    logRetention: RetentionDays.ONE_WEEK,
    lambdaMemoryMb: 256,
    lambdaTimeout: Duration.seconds(10),
    logLevel: 'debug',
    apiLoggingLevel: MethodLoggingLevel.INFO,
  },
  prod: {
    envName: 'prod',
    logRetention: RetentionDays.THREE_MONTHS,
    lambdaMemoryMb: 512, // more memory = more CPU, mostly helps cold starts
    lambdaTimeout: Duration.seconds(10),
    logLevel: 'info',
    apiLoggingLevel: MethodLoggingLevel.ERROR,
  },
};

export function getConfig(envName: string | undefined): EnvConfig {
  const name = (envName ?? 'dev') as EnvName;
  const config = configs[name];
  if (!config) {
    throw new Error(`Unknown env "${envName}", expected one of: ${Object.keys(configs).join(', ')}`);
  }
  return config;
}
