import * as cdk from 'aws-cdk-lib';
import * as SpecificRoutingDemo from '../lib/specific-routing-demo-stack';

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new SpecificRoutingDemo.SpecificRoutingDemoStack(app, 'MyTestStack');
    // THEN
    const actual = app.synth().getStackArtifact(stack.artifactId).template;
    expect(actual.Resources ?? {}).toEqual({});
});
