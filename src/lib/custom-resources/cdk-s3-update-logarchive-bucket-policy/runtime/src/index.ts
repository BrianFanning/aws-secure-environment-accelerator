import * as AWS from 'aws-sdk';
AWS.config.logger = console;
import {
  CloudFormationCustomResourceEvent,
  CloudFormationCustomResourceCreateEvent,
  CloudFormationCustomResourceUpdateEvent,
  CloudFormationCustomResourceDeleteEvent,
} from 'aws-lambda';
import { errorHandler } from '@aws-accelerator/custom-resource-runtime-cfn-response';
import { addCustomResourceTags } from '@aws-accelerator/custom-resource-runtime-cfn-tags';
import { throttlingBackOff } from '@aws-accelerator/custom-resource-cfn-utils';

export interface HandlerProperties {
  roles: string[];
  logBucketArn: string;
  logBucketName: string;
  logBucketKmsKeyArn: string | undefined;
}

export const handler = errorHandler(onEvent);

const kms = new AWS.KMS();
const s3 = new AWS.S3();
const bucketPolicyStatementId = "SSM Log Archive Read Only Roles"

async function onEvent(event: CloudFormationCustomResourceEvent) {
  console.log(`Adding roles with /'ssm-log-archive-read-only-access: true/' to the Log Archive Bucket Policy...`);
  console.log(JSON.stringify(event, null, 2));

  // eslint-disable-next-line default-case
  switch (event.RequestType) {
    case 'Create':
      return onCreate(event);
    case 'Update':
      return onUpdate(event);
    case 'Delete':
      return onDelete(event);
  }
}

async function getBucketPolicy(logBucketName: string) {
  try {
    const response = await s3.getBucketPolicy({
      Bucket: logBucketName
    }).promise()
    if(response.Policy) {
      return JSON.parse(response.Policy)
    }
    else {
      return {}
    }
  }
  catch (err) {
    console.error(err, err.stack);
    throw err;
  }
}

async function putBucketPolicy(logBucketName: string, policy: string) {
  try {
    const response = await s3.putBucketPolicy({
      Bucket: logBucketName,
      Policy: policy
    }).promise()
  }
  catch (err) {
    console.error(err, err.stack);
    throw err;
  }
}

async function onCreate(event: CloudFormationCustomResourceCreateEvent) {
  const properties = getPropertiesFromEvent(event);
  let policy = await getBucketPolicy(properties.logBucketName)

  const logArchiveReadOnlyStatement = {
    Sid: bucketPolicyStatementId,
    Effect: 'Allow',
    Action: ['s3:GetObject'],
    Principals: properties.roles,
  }

  if(Object.keys(policy).length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const policyStatements: any[] = policy.Statement

    // If there is an existing "SSM Log Archive Read Only Roles" statement, remove it
    let updatedStatements = policyStatements.filter(statement => statement['Sid'] !== bucketPolicyStatementId)
    updatedStatements.push(logArchiveReadOnlyStatement)
    policy.Statement = updatedStatements
  }
  else {
    policy = {
      Version: "2012-10-17",
      Statement: [logArchiveReadOnlyStatement]
    }
  }
  const response = await putBucketPolicy(properties.logBucketName, JSON.stringify(policy))
  return {}
}

async function onUpdate(event: CloudFormationCustomResourceUpdateEvent) {
  const properties = getPropertiesFromEvent(event);
  let policy = await getBucketPolicy(properties.logBucketName)

  const logArchiveReadOnlyStatement = {
    Sid: bucketPolicyStatementId,
    Effect: 'Allow',
    Action: ['s3:GetObject'],
    Principals: properties.roles,
  }

  if(Object.keys(policy).length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const policyStatements: any[] = policy.Statement

    // Remove existing "SSM Log Archive Read Only Roles" statement
    let updatedStatements = policyStatements.filter(statement => statement['Sid'] !== bucketPolicyStatementId)
    updatedStatements.push(logArchiveReadOnlyStatement)
    policy.Statement = updatedStatements
  }
  else {
    policy = {
      Version: "2012-10-17",
      Statement: [logArchiveReadOnlyStatement]
    }
  }
  const response = await putBucketPolicy(properties.logBucketName, JSON.stringify(policy))
  return {}
}

async function onDelete(event: CloudFormationCustomResourceDeleteEvent) {
  const properties = getPropertiesFromEvent(event);
  let policy = await getBucketPolicy(properties.logBucketName)

  const logArchiveReadOnlyStatement = {
    Sid: bucketPolicyStatementId,
    Effect: 'Allow',
    Action: ['s3:GetObject'],
    Principals: properties.roles,
  }

  if(Object.keys(policy).length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const policyStatements: any[] = policy.Statement

    // If there is an existing "SSM Log Archive Read Only Roles" statement, remove it
    let updatedStatements = policyStatements.filter(statement => statement['Sid'] !== bucketPolicyStatementId)
    updatedStatements.push(logArchiveReadOnlyStatement)
    policy.Statement = updatedStatements
    const response = await putBucketPolicy(properties.logBucketName, JSON.stringify(policy))
  }
  else {
    return {}
  }
  return {}
}

function getPropertiesFromEvent(event: CloudFormationCustomResourceEvent) {
  return (event.ResourceProperties as unknown) as HandlerProperties;
}
