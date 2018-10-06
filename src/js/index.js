/*!
 * Terminalizer Web Player
 * https://terminalizer.com
 * 
 * @author Mohammad Fares <faressoft.com@gmail.com>
 */

import $ from 'jquery';
import {Terminalizer} from './terminalizer.js';

/**
 * Terminalizer jQuery Plugin
 * 
 * - If the first argument is an object
 *   - A new Terminalizer instance will be attached to the element
 *   - The passed object will be used to override the defaults
 * - If the first argument is a string
 *   - The Terminalizer's method that matches the string will be called
 *   - Any extra arguments will be passed to the method 
 *
 * Methods:
 * ------------
 * - getFramesCount
 * - play
 * - pause
 * - jump
 * 
 * Events:
 * ------------
 * - init
 * - playingCompleted
 * - playingStarted
 * - playingPaused
 */
$.fn.terminalizer = function() {

  var options = {};
  var method = {};
  var methodArgs = [];

  if (arguments.length == 0) {
    throw new Error('The options argument is required');
  }

  if (typeof arguments[0] == 'string') {

    method = arguments[0];
    methodArgs = Array.prototype.slice.call(arguments, 1);

    if (typeof this.data('terminalizer') == 'undefined') {
      throw new Error('It is not Terminalizer element');
    }

    return this.data('terminalizer')[method].apply(this.data('terminalizer'), methodArgs);

  }

  if (typeof this.data('terminalizer') != 'undefined') {
    return this;
  }

  options = arguments[0];
  this.data('terminalizer', new Terminalizer(this[0], options));

  return this;
  
};
