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

async function onCreate(event: CloudFormationCustomResourceCreateEvent) {
  const properties = getPropertiesFromEvent(event);
  s3.getBucketPolicy({
    Bucket: properties.logBucketName
  }, 
  function (err, data) {
    if(err) {
      console.error(err, err.stack);
    }
    const logArchiveReadOnlyStatement = {
      Sid: bucketPolicyStatementId,
      Effect: 'Allow',
      Action: ['s3:GetObject'],
      Principals: properties.roles,
    }
    if(data.Policy) {
      let policyJson = JSON.parse(data.Policy)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const policyStatements: any[] = policyJson.Statement

      // If there is an existing "SSM Log Archive Read Only Roles" statement, remove it
      let updatedStatements = policyStatements.filter(statement => statement['Sid'] !== bucketPolicyStatementId)
      updatedStatements.push(logArchiveReadOnlyStatement)
      policyJson.Statement = updatedStatements
      s3.putBucketPolicy({
        Bucket: properties.logBucketName,
        Policy: JSON.stringify(policyJson)
      },
      function(err, data) {
        if(err) {
          console.error(err, err.stack);
        }
        return {}
      })
    }
    else {
      const bucketPolicy = {
        Version: "2012-10-17",
        Statement: [logArchiveReadOnlyStatement]
      }
      s3.putBucketPolicy({
        Bucket: properties.logBucketName,
        Policy: JSON.stringify(bucketPolicy)
      },
      function(err, data) {
        if(err) {
          console.error(err, err.stack);
        }
        return {}
      })
    }
  })
}

async function onUpdate(event: CloudFormationCustomResourceUpdateEvent) {
  const properties = getPropertiesFromEvent(event);
  s3.getBucketPolicy({
    Bucket: properties.logBucketName
  }, 
  function (err, data) {
    if(err) {
      console.error(err, err.stack);
    }
    if(data.Policy) {
      let policyJson = JSON.parse(data.Policy)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const policyStatements: any[] = policyJson.Statement

      // If there is an existing "SSM Log Archive Read Only Roles" statement, remove it
      let updatedStatements = policyStatements.filter(statement => statement['Sid'] !== bucketPolicyStatementId)
      const logArchiveReadOnlyStatement = {
        Sid: bucketPolicyStatementId,
        Effect: 'Allow',
        Action: ['s3:GetObject'],
        Principals: properties.roles,
      }
      updatedStatements.push(logArchiveReadOnlyStatement)
      policyJson.Statement = updatedStatements
      s3.putBucketPolicy({
        Bucket: properties.logBucketName,
        Policy: JSON.stringify(policyJson)
      },
      function(err, data) {
        if(err) {
          console.error(err, err.stack);
        }
        return {}
      })
    }
    else {
      console.error("Bucket policy is missing")
    }
  })
}

async function onDelete(event: CloudFormationCustomResourceDeleteEvent) {
  const properties = getPropertiesFromEvent(event);
  s3.getBucketPolicy({
    Bucket: properties.logBucketName
  }, 
  function (err, data) {
    if(err) {
      console.error(err, err.stack);
    }
    if(data.Policy) {
      let policyJson = JSON.parse(data.Policy)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const policyStatements: any[] = policyJson.Statement
      let updatedStatements = policyStatements.filter(statement => statement['Sid'] !== bucketPolicyStatementId)
      policyJson.Statement = updatedStatements
      s3.putBucketPolicy({
        Bucket: properties.logBucketName,
        Policy: JSON.stringify(policyJson)
      },
      function(err, data) {
        if(err) {
          console.error(err, err.stack);
        }
        return {}
      })
    }
    return {}
  })
}

function getPropertiesFromEvent(event: CloudFormationCustomResourceEvent) {
  return (event.ResourceProperties as unknown) as HandlerProperties;
}
