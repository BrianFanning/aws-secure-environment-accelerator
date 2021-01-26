import * as s3 from '@aws-cdk/aws-s3';
import * as iam from '@aws-cdk/aws-iam';
import { AccountStacks } from '../../common/account-stacks';
import { AcceleratorConfig } from '@aws-accelerator/common-config/src';
import { Account, getAccountId } from '@aws-accelerator/common-outputs/src/accounts';

export interface LogArchiveReadAccessProps {
  accountStacks: AccountStacks;
  accounts: Account[]
  logBucketInfo: s3.IBucket;
  config: AcceleratorConfig;
}

export async function logArchiveReadOnlyAccess(props:LogArchiveReadAccessProps) {
  const { accountStacks, accounts, logBucketInfo, config } = props;

  const logArchiveAccountKey = config['global-options']['central-log-services'].account;
  const logArchiveStack = accountStacks.getOrCreateAccountStack(logArchiveAccountKey);

  const logBucket = s3.Bucket.fromBucketArn(logArchiveStack, 'LogArchiveBucket', logBucketInfo.bucketArn);

  // Update Log Archive Bucket and KMS Key policies for roles with ssm-log-archive-read-only-access
  for (const {accountKey, iam: iamConfig} of config.getIamConfigs()) {
    const accountId = getAccountId(accounts, accountKey);
    const roles = iamConfig.roles || [];
    for (const role of roles) {
      if (role['ssm-log-archive-read-only-access']) {
        const rolePrincipal = new iam.ArnPrincipal(`arn:aws:iam::${accountId}:role/${role.role}`)
        logBucket.addToResourcePolicy(
          new iam.PolicyStatement({
            actions: ['s3:GetObject'],
            principals: [rolePrincipal],
            resources: [`${logBucket.bucketArn}/*`],
          })
        )
        logBucket.encryptionKey?.addToResourcePolicy(
          new iam.PolicyStatement({
            actions: ['kms:Decrypt'],
            principals: [rolePrincipal],
            resources: ['*']
          })
        )
      }
    }
  }
}
