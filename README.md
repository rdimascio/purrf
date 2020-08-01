# Purrf

[![Build status](https://img.shields.io/travis/rdimascio/purrf/master?style=flat-square)](https://travis-ci.org/rdimascio/purrf)
<!-- [![Coverage](https://img.shields.io/coveralls/github/rdimascio/purrf/master?style=flat-square)](https://coveralls.io/github/rdimascio/purrf?branch=master) -->
[![npm version](https://img.shields.io/npm/v/purrf?style=flat-square)](https://www.npmjs.com/package/purrf)
[![Donate](https://img.shields.io/badge/donate-paypal-blue?style=flat-square)](https://www.paypal.me/rdimascio/5)

A simple utility to track asset and network performance.

```ssh
npm install purrf
```

## What is Purrf?

Purrf utilizes the Permormance browser API to reveal metrics on resource performance and log them in AWS CloudWatch.

## Usage

### 1. Install

```ssh
npm i -S purrf
```

### 2. Usage

Import Purrf from npm and initialize a new instance.

```js
import Purrf from 'purrf';

new Purrf();
```

You can also install Purrf from a CDN.

```html
<script src="https://unpkg.com/purrf"></script>

<script>
    new Purrf();
</script>
```

You can optionally configure Purrf to suit your needs.

```js
new Purrf({
    includes: [
        '.js'
    ]
});
```

In order to log the metrics to CloudWatch you'll need to pass in your AWS credentials to your instance of Purrf.

```js
new Purrf({
    config: {
        region: 'us-west-1',
        logGroup: '/your/log/group',
        logStream: 'your-log-stream',
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
})
```

## API Reference

Purrf takes the following arguments on intitialization.

*`includes: <string[]>`* - An array of strings to include. If this option exists, Purrf will **only** track resources that match or include items from this list.
*`excludes: <string[]>`* - An array of strings to exclude. If this option exists, Purrf will **not** track resources that match or include items from this list.
*`config: <object>`* - An object with your CloudWatch details and AWS credentials.
