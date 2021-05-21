# Welcome to a CDK Network sample

This is a sample project to create a demo infrastructure to support a AWS News blog post.

Blog Post URL is : TBD

## How to install ?

1. Check or adjust AWS region to deploy. Region is define here `bin/specific-routing-demo.ts:9`

2. Check you are using CDK v2 : `npm install -g aws-cdk@next`

3. Git clone `git clone https://github.com/sebsto/cdkv2-vpc-example.git`

After a git clone, follow these steps 

```bash
cd cdkv2-vpc-example

npm install 
cdk bootstrap # the firts time only
cdk deploy 
```

## Delete the infrastructure

This infrastructure creates 3 `t3.nano` instances and one NAT Gateway. It will [cost you $45.46](https://calculator.aws/#/estimate?id=7e5c8894a195e9935be801c7955ebc6b34eff513) per month ($0.063 per hour), assuming you keep the same region and run the infrastructure 24/7 on-demand)

When you have finished exploring this demo, you can delete the entire infrastructure with 

```bash
cdk destroy
```

## AWS CLI Commands for the demo 

### Connect to the bastion host

There is no SSH key installed on the host, access the bastion through [SSM](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager.html) only.

(from your laptop) 

```zsh
$ REGION=us-west-2 #adjust if you changed the region above 

$ INSTANCE_ID=$(aws --region $REGION ec2 describe-instances                              \
               --filter "Name=tag:Name,Values=BastionHost"                               \               
               --query "Reservations[].Instances[?State.Name == 'running'].InstanceId[]" \
               --output text)

$ aws --region $REGION ssm start-session --target $INSTANCE_ID
```

### Find the application Private IP Address

(from your laptop) 

```zsh
$ aws --region $REGION 
    ec2 describe-instances                                                        \
    --filter "Name=tag:Name,Values=application"                                   \
    --query "Reservations[].Instances[?State.Name == 'running'].PrivateIpAddress" \
    --output text  

10.0.1.16
```

### Test connectivity to the application

(from the bastion host) 

```zsh
$ curl -I <application private ip address>

HTTP/1.1 200 OK
Server: nginx/1.18.0
Date: Fri, 21 May 2021 08:02:13 GMT
Content-Type: text/html
Content-Length: 12338
Last-Modified: Thu, 20 May 2021 19:47:39 GMT
Connection: keep-alive
ETag: "60a6bcdb-3032"
Accept-Ranges: bytes
```

## Useful commands

 * `npm run build`   compile typescript to js
 * `npm run watch`   watch for changes and compile
 * `npm run test`    perform the jest unit tests
 * `cdk deploy`      deploy this stack to your default AWS account/region
 * `cdk diff`        compare deployed stack with current state
 * `cdk synth`       emits the synthesized CloudFormation template
