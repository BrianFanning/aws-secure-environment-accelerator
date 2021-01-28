# S3 Update LogArchive Policy

This is a custom resource to add any roles with the 'ssm-log-archive-read-only-access' flag set to true to access the LogArchive bucket

## Usage

    import { S3UpdateLogArchivePolicy } from '@aws-accelerator/custom-resource-s3-update-logarchive-policy';

    new S3UpdateLogArchivePolicy(scope, `UpdateLogArchivePolicy`, {
      roles: string[],
      logBucket: s3.IBucket
    });
