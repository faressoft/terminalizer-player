# Terminalizer Web Player

[![npm](https://img.shields.io/npm/v/terminalizer-player.svg)](https://www.npmjs.com/package/terminalizer-player)
[![npm](https://img.shields.io/npm/l/terminalizer-player.svg)](https://github.com/faressoft/terminalizer-player/blob/master/LICENSE)

> A web player for [Terminalizer](https://github.com/faressoft/terminalizer)'s recordings

# Table of Contents

* [Installation](#installation)
* [Usage](#usage)
  * [Methods](#methods)
  * [Events](#events)
* [License](#license)

# Installation

```bash
npm install --save terminalizer-player
```

Install dependencies:

* jquery@3.x.x
* xterm@3.5.1

```bash
npm install --save jquery@3 xterm@3.5.1
```

# Usage

Terminalizer player can be used as:

* ES6 module with `import`.
* CommonJS module with `require`.
* AMD module with `require`.
* Browser global.

Add the following styles to the `head` element:

```html
<link rel="stylesheet" type="text/css" href="xterm.css">
<link rel="stylesheet" type="text/css" href="terminalizer.min.css">
```

Add the following scripts before `</body>` tag:

```html
<script src="jquery.min.js"></script>
<script src="xterm.js"></script>
<script src="terminalizer.min.js"></script>
```

Add the following script

```js
// Initialize the terminalizer plugin
$('#terminal').terminalizer({
  recordingFile: 'data.json'
});
```

## Methods

Not documented here yet !

## Events

Not documented here yet !

# License

This project is under the MIT license.
