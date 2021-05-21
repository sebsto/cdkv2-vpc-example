import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';

import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { aws_iam as iam } from 'aws-cdk-lib';
import { aws_s3_assets as assets } from 'aws-cdk-lib';

export class SpecificRoutingDemoStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Create a VPC with three subnets : two isolated and one public
    const vpc = new ec2.Vpc(this, 'NewsBlogVPC', {
      natGateways: 1, //default value but better to make it explicit
      maxAzs: 1,
      cidr: '10.0.0.0/16',
      subnetConfiguration: [{
        subnetType: ec2.SubnetType.PUBLIC,
        name: 'bastion',
        cidrMask: 24,
      }, {
        subnetType: ec2.SubnetType.PRIVATE,
        name: 'application',
        cidrMask: 24
      }, {
        subnetType: ec2.SubnetType.ISOLATED,
        name: 'appliance',
        cidrMask: 24
      }]
    });

    // create a bastion host in the public subnet
    const bastionHost = new ec2.BastionHostLinux(this, 'BastionHost', {
      vpc,
      subnetSelection: { subnetType: ec2.SubnetType.PUBLIC },
    });

    //
    // Create a security group allowing connection on TCP 80 from the bastion 
    //
    const demoSecurityGroup = new ec2.SecurityGroup(this, 'DemoSecurityGroup', {
      vpc,
      description: 'Allow access to ec2 instances',
      allowAllOutbound: true   // Can be set to false
    });
    demoSecurityGroup.addIngressRule(
      bastionHost.instance.connections.securityGroups[0],
      ec2.Port.tcp(80),
      'Allows HTTP connection from bastion security group');

    //
    // create HTML web site as S3 assets 
    //
    var path = require('path');
    const asset = new assets.Asset(this, 'ApplicationAsset', {
      path: path.join(__dirname, '../html')
    });

    //
    // define the IAM role that will allow the EC2 instance to download web site from S3 
    //
    const s3Role = new iam.Role(this, 'NewsBlogS3Role', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com')
    });
    // allow to read from this s3 bucket
    asset.grantRead(s3Role);

    //
    // define a user data script to install & launch a web server
    //
    const userData = ec2.UserData.forLinux();
    userData.addCommands('amazon-linux-extras install nginx1 -y',
      'systemctl enable nginx.service',
      'systemctl start nginx.service');
    userData.addCommands(
      `aws s3 cp ${asset.s3ObjectUrl} .`,
      `unzip *.zip`,
      `/bin/mv /usr/share/nginx/html/index.html /usr/share/nginx/html/index.html.orig`,
      `/bin/cp -r -n index.html carousel.css /usr/share/nginx/html/`);

    //
    // create a web server in the isolated subnet 
    //
    const applicationInstance = new ec2.Instance(this, 'ApplicationInstance', {
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.NANO),
      machineImage: new ec2.AmazonLinuxImage({ generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2 }),
      vpc: vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE },
      instanceName: 'application',
      userData: userData,
      securityGroup: demoSecurityGroup,
      role: s3Role
    });

    //
    // create the appliance instance in the isolated subnet 
    //
    const applianceInstance = new ec2.Instance(this, 'ApplianceInstance', {
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.NANO),
      machineImage: new ec2.AmazonLinuxImage({ generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2 }),
      vpc: vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.ISOLATED },
      instanceName: 'appliance',
      sourceDestCheck: true
    });

    //TEMP for debugging user data
    // const policy = {
    //   Action: [
    //     "ssmmessages:*",
    //     "ssm:UpdateInstanceInformation",
    //     "ec2messages:*"
    //   ],
    //   Resource: "*",
    //   Effect: "Allow"
    // }

    // instance.addToRolePolicy(iam.PolicyStatement.fromJson(policy));
  }
}
