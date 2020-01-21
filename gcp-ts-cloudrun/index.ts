// Copyright 2016-2019, Pulumi Corporation.  All rights reserved.

import * as pulumi from "@pulumi/pulumi";
import * as docker from "@pulumi/docker";
import * as gcp from "@pulumi/gcp";

// Location to deploy Cloud Run services
const location = gcp.config.region || "us-central1";

// Enable Cloud Run service for the current project
const enableCloudRun = new gcp.projects.Service("EnableCloudRun", {
    service: "run.googleapis.com",
});

// ----------------------------------------------- //
// Deploy a pre-existing Hello Cloud Run container //
// ----------------------------------------------- //
const helloService = new gcp.cloudrun.Service("hello", {
    location,    
    template: {
        spec: {
            containers: [
                { image: "gcr.io/cloudrun/hello" }
            ]
        }
    },
}, { dependsOn: enableCloudRun });

// Open the service to public unrestricted access
new gcp.cloudrun.IamMember("hello-everyone", {
    service: helloService.name,
    location,
    role: "roles/run.invoker",
    member: "allUsers",
});

// Export the URL
export const helloUrl = helloService.status.url;


// -------------------------------------- //
// Deploy a custom container to Cloud Run //
// -------------------------------------- //

// Build a Docker image from our sample Ruby app and put it to Google Container Registry.
// Note: Run `gcloud auth configure-docker` in your command line to configure auth to GCR.
const imageName = "ruby-app";
const myImage = new docker.Image(imageName, {
    imageName: pulumi.interpolate`gcr.io/${gcp.config.project}/${imageName}:v1.0.0`,
    build: {
        context: "./app",
    },
});

// Deploy to Cloud Run. Some extra parameters like concurrency and memory are set for illustration purpose.
const rubyService = new gcp.cloudrun.Service("ruby", {
    location, 
    template: {
        spec: {
            containers: [{ 
                image: myImage.imageName,
                resources: {
                    limits: {
                        memory: "1Gi",
                    },
                },
            }],
            containerConcurrency: 50,
        },
    },
}, { dependsOn: enableCloudRun });

// Open the service to public unrestricted access
new gcp.cloudrun.IamMember("ruby-everyone", {
    service: rubyService.name,
    location,
    role: "roles/run.invoker",
    member: "allUsers",
});

// Export the URL
export const rubyUrl = rubyService.status.url;