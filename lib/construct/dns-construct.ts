import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as targets from "aws-cdk-lib/aws-route53-targets";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";

export interface DnsConstructProps {
  appName: string;
  domainName: string;
}

export class DnsConstruct extends Construct {
  public readonly certificate: acm.Certificate;
  public readonly hostedZone: route53.IHostedZone;
  private readonly appName: string;

  constructor(scope: Construct, id: string, props: DnsConstructProps) {
    super(scope, id);

    this.appName = props.appName;

    // ACM Certificate for HTTPS
    this.certificate = new acm.Certificate(this, "Certificate", {
      domainName: props.domainName,
      subjectAlternativeNames: [`*.${props.domainName}`],
      validation: acm.CertificateValidation.fromDns(),
    });

    // Route 53 Hosted Zone (assuming it exists)
    this.hostedZone = route53.HostedZone.fromLookup(this, "HostedZone", {
      domainName: props.domainName,
    });
  }

  public createAliasRecord(alb: elbv2.ApplicationLoadBalancer): route53.ARecord {
    return new route53.ARecord(this, "AliasRecord", {
      zone: this.hostedZone,
      target: route53.RecordTarget.fromAlias(new targets.LoadBalancerTarget(alb)),
      recordName: this.appName,
    });
  }
}
