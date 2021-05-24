import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';

import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { aws_iam as iam } from 'aws-cdk-lib';
import { aws_s3_assets as assets } from 'aws-cdk-lib';

export class SpecificRoutingDemoStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Create a VPC with three subnets : two isolated and one public
    const vpc = new ec2.Vpc(this, 'SpecificRoutingVPC', {
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
        subnetType: ec2.SubnetType.PRIVATE, 
        name: 'appliance',
        cidrMask: 24,

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
    const applicationSecurityGroup = new ec2.SecurityGroup(this, 'ApplicationSecurityGroup', {
      vpc,
      description: 'Allow access to ec2 instances',
      allowAllOutbound: true   // Can be set to false
    });
    applicationSecurityGroup.addIngressRule(
      bastionHost.instance.connections.securityGroups[0],
      ec2.Port.tcp(80),
      'Allows HTTP connection from bastion security group');

    //
    // create HTML web site as S3 assets 
    //
    var path = require('path');
    const asset = new assets.Asset(this, 'SpecificRoutingApplicationAsset', {
      path: path.join(__dirname, '../html')
    });

    //
    // define the IAM role that will allow the application EC2 instance to download web site from S3 
    //
    const s3Role = new iam.Role(this, 'SpecificRoutingS3Role', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com')
    });
    // allow to read from this s3 bucket
    asset.grantRead(s3Role);

    //
    // define a user data script to install & launch a web server on the application instance
    //
    const createWebServerUserdata = ec2.UserData.forLinux();
    createWebServerUserdata.addCommands('amazon-linux-extras install nginx1 -y',
      'systemctl enable nginx.service',
      'systemctl start nginx.service');
      createWebServerUserdata.addCommands(
      `aws s3 cp ${asset.s3ObjectUrl} .`,
      `unzip *.zip`,
      `/bin/mv /usr/share/nginx/html/index.html /usr/share/nginx/html/index.html.orig`,
      `/bin/cp -r -n index.html carousel.css /usr/share/nginx/html/`);

    //
    // create the application instance : a web server in the isolated subnet 
    //
    const applicationInstance = new ec2.Instance(this, 'SpecificRoutingApplicationInstance', {
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.NANO),
      machineImage: new ec2.AmazonLinuxImage({ generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2 }),
      vpc: vpc,
      vpcSubnets: { subnetGroupName: 'application'},
      instanceName: 'application',
      userData: createWebServerUserdata,
      securityGroup: applicationSecurityGroup,
      role: s3Role
    });

    //
    // define a user data script to enable routing at kernel level for the appliance instance
    //
    const enableRoutingUserdata = ec2.UserData.forLinux();
    enableRoutingUserdata.addCommands(
      'sysctl -w net.ipv4.ip_forward=1',
      'sysctl -w net.ipv6.conf.all.forwarding=1');

    //
    // create the appliance instance in the isolated subnet 
    //
    const applianceInstance = new ec2.Instance(this, 'SpecificRoutingApplianceInstance', {
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.NANO),
      machineImage: new ec2.AmazonLinuxImage({ generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2 }),
      vpc: vpc,
      vpcSubnets: { subnetGroupName: 'appliance'},
      instanceName: 'appliance',
      userData: enableRoutingUserdata,
      sourceDestCheck: false
    });

    //
    // Allows to connect to the appliance and application instances through SSM 
    // This is just required for inspections / debuging
    //

    // Create an IAM permission to allow the instances to connect to SSM 
    const policy = {
      Action: [
        "ssmmessages:*",
        "ssm:UpdateInstanceInformation",
        "ec2messages:*"
      ],
      Resource: "*",
      Effect: "Allow"
    }

    applianceInstance.addToRolePolicy(iam.PolicyStatement.fromJson(policy));
    applicationInstance.addToRolePolicy(iam.PolicyStatement.fromJson(policy));
    // not require for the bastion host, it is part of the Bastio construct 

    // output the VPC ID for easy retrieval
    new CfnOutput(this, 'VPC-ID', { value: vpc.vpcId });
  }
}
