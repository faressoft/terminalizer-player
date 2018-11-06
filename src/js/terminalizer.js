// Third-party Scripts
import * as xterm from 'xterm';

/**
 * Terminalizer Web Player
 * https://terminalizer.com
 * 
 * @author Mohammad Fares <faressoft.com@gmail.com>
 */
export function Terminalizer(element, options) {

  var self = this;

  /**
   * A reference to the DOM element
   * @type {Object}
   */
  self.element = element;

  /**
   * A reference to the jQuery element
   * @type {Object}
   */
  self.$element = $(element);

  /**
   * The terminal instance
   * @type {Object}
   */
  self._terminal = null;

  /**
   * The frames
   * in the format [
   *   {
   *     content,
   *     delay,
   *     duration,
   *     startTime,
   *     endTime
   *   },
   *   ..
   * ]
   * @type {Array}
   */
  self._frames = null;

  /**
   * The summation of the adjusted frames delays
   * @type {Array}
   */
  self._totalDuration = 0;

  /**
   * The current time of the player
   * @type {Array}
   */
  self._currentTime = 0;

  /**
   * The playing timer
   * @type {Object}
   */
  self._timer = null;

  /**
   * The time at the last timer tick in ms
   * @type {Number}
   */
  self._lastTickTime = null;

  /**
   * Is playing
   * @type {Boolean}
   */
  self._isPlaying = false;

  /**
   * Is the played at least once
   * @type {Boolean}
   */
  self._isStarted = false;

  /**
   * Is blocked for the rendering via a timer's tick or jumping
   * @type {Boolean}
   */
  self._isRendering = false;

  /**
   * The index of the last rendered frame
   * @type {Number}
   */
  self._lastRenderedFrame = -1;

  /**
   * HTML template for the start SVG icon
   * @type {String}
   */
  self._startTemplate = '<?xml version="1.0" ?><svg id="Layer_1"' +
    ' style="enable-background:new 0 0 30 30;" version="1.1" viewBox="0 0 30 30"' +
    ' xml:space="preserve" xmlns="http://www.w3.org/2000/svg"' +
    ' xmlns:xlink="http://www.w3.org/1999/xlink">' +
    '<polygon points="6.583,3.186 5,4.004 5,15 26,15 26.483,14.128 "/>' +
    '<polygon points="6.583,26.814 5,25.996 5,15 26,15 26.483,15.872 "/>' +
    '<circle cx="26" cy="15" r="1"/><circle cx="6" cy="4" r="1"/>' +
    '<circle cx="6" cy="26" r="1"/></svg>';

  /**
   * HTML template for the player
   * @type {String}
   */
  self._playerTemplate = '<div class="terminalizer-player">' +
    '<div class="cover"></div>' +
    '<div class="start">' + self._startTemplate + '</div>' +
    '<div class="terminalizer"></div>' +
    '<div class="controller">' +
    '<div class="play"><span class="icon"></span></div>' +
    '<div class="pause"><span class="icon"></span></div>' +
    '<div class="timer">00:00</div>' +
    '<div class="progressbar-wrapper">' +
    '<div class="progressbar">' +
    '<div class="progress"></div>' +
    '</div></div></div></div>';

  /**
   * HTML template for the terminal
   * @type {String}
   */
  self._terminalTemplate = '<div class="terminalizer">' +
    '<div class="terminalizer-frame">' +
    '<div class="terminalizer-titlebar">' +
    '<div class="buttons">' + 
    '<div class="close-button"></div>' + 
    '<div class="minimize-button"></div>' +
    '<div class="maximize-button"></div>' +
    '</div><div class="title"></div>' + 
    '</div>' +
    '<div class="terminalizer-body"></div>' +
    '</div></div>';

  /**
   * Options
   * @type {Object}
   */
  self._options = $.extend({
    recordingFile: null,
    realTiming: false,
    speedFactor: 1.0,
    beforeMiddleware: null,
    afterMiddleware: null,
    controls: true,
    repeat: false,
    autoplay: false,
    thumbnailTime: 0
  }, options);

  // Initialize Terminalizer
  self._init().then(function(result) {
  
    // Autoplay is enabled
    if (self._options.autoplay) {
      return self.play();
    }

  }).catch(function(error) {
  
    throw new Error(error);
    
  });

  return self;

}

/**
 * Initialize Terminalizer
 *
 * @return {Promise}
 */
Terminalizer.prototype._init = function() {

  var self = this;
  var element = self.element;
  var $element = self.$element;

  // Load the recording file
  return self._loadJSON(self._options.recordingFile).then(function(result) {

    // Store a reference to the frames
    self._frames = result.frames || result.records;

    // Marge the plugin's options with recording file's configs
    self._options = $.extend(result.config, self._options);

    // If the controls is enabled
    if (self._options.controls) {

      // Use null frame
      self._options.frameBox.title = null;
      self._options.frameBox.type = null;
      self._options.frameBox.style = {};

      // Set the background color
      if (self._options.theme.background == 'transparent') {
        self._options.frameBox.style.background = 'black';
      } else {
        self._options.frameBox.style.background = self._options.theme.background;
      }

      // Add paddings to the frame
      self._options.frameBox.style.padding = '10px';

      // Remove the watermark
      self._options.watermark.imagePath = null;

    }

    // Create a terminal instance
    self._terminal = new Terminal({
      cols: self._options.cols,
      rows: self._options.rows,
      cursorStyle: self._options.cursorStyle,
      fontFamily: self._options.fontFamily,
      fontSize: self._options.fontSize,
      lineHeight: self._options.lineHeight,
      letterSpacing: self._options.letterSpacing,
      allowTransparency: true,
      scrollback: 0,
      theme: self._options.theme
    });

    // Insert the player template
    $element.html($(self._playerTemplate));

    // Insert the terminal template
    $element.find('.terminalizer').replaceWith(self._terminalTemplate);

    if (self._options.frameBox.type) {
      $element.find('.terminalizer-frame').addClass('terminalizer-' + self._options.frameBox.type);
    }

    if (self._options.frameBox.type && self._options.frameBox.title) {
      $element.find('.terminalizer-frame .title').text(self._options.frameBox.title);
    }

    $element.find('.terminalizer-frame').css(self._options.frameBox.style);

    // If the controls is enabled
    if (self._options.controls) {
      $element.find('.terminalizer-player').addClass('controls');
    }

    // If the frame not null, push the start button down
    if (self._options.frameBox.type) {
      $element.find('.terminalizer-player').addClass('framed');
    }

    // Use smaller start icon
    if (self._options.rows < 10) {
      $element.find('.terminalizer-player').addClass('small');
    }

    // Open the terminal
    self._terminal.open($element.find('.terminalizer-body')[0]);

    // A hack to keep the focus on the terminal
    Object.defineProperty(self._terminal._core, 'isFocused', {
      get: function() {
        return true;
      }
    });

    // Initialize the controller
    self._initController();

    // A Wrapper around the refresh event of the Terminal
    self._initRenderedEmitter();
  
    // Emit the event on the Terminalizer element
    self._emit('init');

    // Adjust the delays of the frames, considering to the options
    self._adjustDelays();

    // Calculate and set the duration, startTime, and endTime for each frame
    self._calculateTiming();

    // Sum the adjusted frames delays
    self._totalDuration = self._calculateTotalDuration();

    // Start the playing timer
    self._lastTickTime = Date.now();
    self._timer = setInterval(self._tick.bind(self), 1);

    // Add a watermark
    if (self._options.watermark.imagePath) {
      return self._addWatermark(self._options.watermark);
    }

  }).then(function() {
  
    return self.jump(self._options.thumbnailTime, false);
  
  }).then(function() {
  
    // Set the current time to the time of the frame
    self._currentTime = 0;

    // Update the player (time and progressbar)
    self._updatePlayer();
  
  });

};

/**
 * Initialize the controller
 *
 * - Attach event handlers
 */
Terminalizer.prototype._initController = function() {

  var self = this;

  /**
   * A callback function for the event:
   * When the progressbar is clicked
   * 
   * @param {Object} event
   */
  self.$element.find('.controller .progressbar').on('click', function(event) {

    // Not started yet
    if (!self._isStarted) {
      return false;
    }

    var length = $(this).width();
    var position = event.offsetX;

    self.jump(Math.floor(self._totalDuration * position / length));

    return false;

  });
  
  /**
   * A callback function for the event:
   * When the start button is clicked
   * 
   * @param {Object} event
   */
  self.$element.find('.cover, .start').on('click', function(event) {

    self.play();
    return false;

  });
  
  /**
   * A callback function for the event:
   * When the play button is clicked
   * 
   * @param {Object} event
   */
  self.$element.find('.controller .play').on('click', function(event) {

    self.play();
    return false;

  });
  
  /**
   * A callback function for the event:
   * When the pause button is clicked
   * 
   * @param {Object} event
   */
  self.$element.find('.controller .pause').on('click', function(event) {

    self.pause();
    return false;

  });
  
};

/**
 * Wrap the refresh event of the Terminal and emit a `rendered` event
 * on the Terminalizer element when all the write operations are executed
 */
Terminalizer.prototype._initRenderedEmitter = function() {

  var self = this;

  self._terminal.on('refresh', function refreshHandler() {

    // Not all write operations are executed yet
    if (this._writeInProgress) {
      return;
    }

    // Emit the event on the Terminalizer element
    self._emit('rendered');

  });
  
};

/**
 * Adjust the delays of the frames, considering to the options
 *
 * - frameDelay
 *   - Delay between frames in ms
 *   - If the value is `auto` use the actual recording delays
 *   
 * - maxIdleTime
 *   - Maximum delay between frames in ms
 *   - Ignored if the `frameDelay` isn't set to `auto`
 *   - Set to `auto` to prevnt limiting the max idle time
 * 
 * - speedFactor
 *   - Multiply the frames delays by this factor
 */
Terminalizer.prototype._adjustDelays = function() {

  var self = this;

  // Foreach frame
  self._frames.forEach(function(frame) {

    var delay = frame.delay;

    // Adjust the delay according to the options
    if (self._options.frameDelay != 'auto') {

      delay = self._options.frameDelay;

    } else if (self._options.maxIdleTime != 'auto' && delay > self._options.maxIdleTime) {

      delay = self._options.maxIdleTime;

    }

    // Apply speedFactor
    delay = delay * self._options.speedFactor;

    // Set the adjusted delay
    frame.delay = delay;

  });
  
};

/**
 * Calculate and set the duration, startTime, and endTime for each frame
 */
Terminalizer.prototype._calculateTiming = function() {

  var currentTime = 0;
  var framesCount = this._frames.length;
  var frames = this._frames;

  // Foreach frame
  frames.forEach(function(frame, index) {

    // Set the duration (the delay of the next frame)
    // The % is used to take the delay of the first frame
    // as the duration of the last frame
    var duration = frames[(index + 1) % framesCount].delay;

    // Set timing values for the current frame
    frame.duration = duration;
    frame.startTime = currentTime;
    frame.endTime = currentTime + duration;

    currentTime = currentTime + duration;
    
  });

};

/**
 * Sum the adjusted frames delays
 * 
 * @return {Number}
 */
Terminalizer.prototype._calculateTotalDuration = function() {

  return this._frames.reduce(function(carry, frame) {

    return carry + frame.delay;
    
  }, 0);
  
};

/**
 * Get the frame's index at a specific time
 * 
 * @param  {Number} time
 * @param  {Number} fromIndex (default: 0)
 * @return {Number}
 */
Terminalizer.prototype._findFrameAt = function(time, fromIndex) {

  var frame = null;

  // Default value for fromIndex
  if (typeof fromIndex == 'undefined') {
    fromIndex = 0;
  }

  // Foreach frame
  for (var i = fromIndex; i < this._frames.length; i++) {

    frame = this._frames[i];

    if (frame.startTime <= time && time < frame.endTime) {
      return i;
    }

  }

  // The endTime of the final frame belongs to it
  if (frame.startTime <= time && time <= frame.endTime) {
    return this._frames.length - 1;
  }

  return -1;
  
};

/**
 * Check if the time belongs to the frame's duration
 * 
 * @param  {Number} time
 * @param  {Number} frameIndex
 * @return {Number}
 */
Terminalizer.prototype._isFrameAt = function(time, frameIndex) {

  var frame = this._frames[frameIndex];

  if (typeof frame == 'undefined') {
    return false;
  }

  if (frame.startTime <= time && time < frame.endTime) {
    return true;
  }

  return false;
  
};

/**
 * Add a watermark and wait until it is fully loaded
 *
 * @param  {Object}  watermarkConfig {imagePath, style}
 * @return {Promise}
 */
Terminalizer.prototype._addWatermark = function(watermarkConfig) {
  
  var watermarkImg = document.createElement('img');

  $(watermarkImg).addClass('terminalizer-watermark');
  $(watermarkImg).attr('src', watermarkConfig.imagePath);
  $(watermarkImg).css(watermarkConfig.style);

  this.$element.find('.terminalizer-frame').prepend(watermarkImg);

  return new Promise(function(resolve, reject) {

    $('.terminalizer-watermark').on('load', resolve);
    
  });

};

/**
 * Render a frame
 *
 * Flow:
 * - Wait for the _options.beforeMiddleware
 * - Render the frame and wait for the rendring
 * - Wait for the _options.afterMiddleware
 *
 * @param {Number}   frameIndex
 * @param {Boolean}  skipMiddlewares
 * @param {Function} callback
 */
Terminalizer.prototype._renderFrame = function(frameIndex, skipMiddlewares, callback) {

  var self = this;
  var tasks = [];
  var frame = self._frames[frameIndex];

  // If beforeMiddleware is set
  if (self._options.beforeMiddleware && !skipMiddlewares) {

    tasks.push(function(callback) {
      self._options.beforeMiddleware.call(self, frame, frameIndex, callback.bind(null, null, null));
    });

  }

  // Rendering
  tasks.push(function(callback) {

    // Render the frame
    self._terminal.write(frame.content);

    /**
     * A callback function for the event:
     * When the write operation is executed and
     * the changes are rendered
     */
    self.$element.one('rendered', function() {

      // An extra tick to allow the browser to complete canvas painting
      setTimeout(function() {
        callback(); 
      });
      
    });

  });

  // If afterMiddleware is set
  if (self._options.afterMiddleware && !skipMiddlewares) {

    tasks.push(function(callback) {
      self._options.afterMiddleware.call(self, frame, frameIndex, callback.bind(null, null, null));
    });

  }

  self._series(tasks, function(error, result) {

    callback();
    
  });

};

/**
 * Load, and parse JSON files
 * 
 * @param  {String}  url
 * @return {Promise}
 */
Terminalizer.prototype._loadJSON = function(url) {

  return new Promise(function(resolve, reject) {

    $.getJSON(url).done(resolve).fail(function(jqxhr, textStatus, error) {
      reject('Failed to load ' + url);
    });
    
  });

};

/**
 * The playing timer's callback
 */
Terminalizer.prototype._tick = function() {

  var self = this;
  var tickDelay = 0;

  tickDelay = Date.now() - self._lastTickTime;
  self._lastTickTime = Date.now();

  // Not playing
  if (!self._isPlaying) {
    return;
  }

  // Still rendering the last frame
  if (self._isRendering) {
    return;
  }

  if (self._currentTime < self._totalDuration) {
    self._currentTime += tickDelay;
    self._updatePlayer();
  }

  if (self._currentTime > self._totalDuration) {
    self._currentTime = self._totalDuration;
  }

  // Already rendered
  if (self._lastRenderedFrame != -1 && self._isFrameAt(self._currentTime, self._lastRenderedFrame)) {
    return;
  }

  // Reached the end
  if (self._lastRenderedFrame == self._frames.length - 1 &&
      self._currentTime == self._totalDuration) {

    // Emit the event on the Terminalizer element
    self._emit('playingCompleted');

    // Repeat is enabled
    if (self._options.repeat) {
      self._currentTime = 0;
      return;
    }

    return self.pause();

  }

  // Check if current time belongs to the next frame's duration
  if (self._isFrameAt(self._currentTime, self._lastRenderedFrame + 1)) {
    self._lastRenderedFrame = self._lastRenderedFrame + 1;
  } else {
    self._lastRenderedFrame = self._findFrameAt(self._currentTime);
  }

  // The start point of the rendering cycle
  self._isRendering = true;

  // Render the frame
  self._renderFrame(self._lastRenderedFrame, false, function() {

    // To discard the time spent rendering
    self._lastTickTime = Date.now();

    // The end point of the rendering cycle
    self._isRendering = false;

  });

};

/**
 * Update the player (time and progressbar)
 */
Terminalizer.prototype._updatePlayer = function() {

  var progress = this._currentTime / this._totalDuration * 100;
  var time = this._formatTime(this._currentTime);

  this.$element.find('.terminalizer-player .progress').width(progress + '%');
  this.$element.find('.terminalizer-player .timer').text(time);
  
};

/**
 * Emit an event on the Terminalizer element
 * 
 * @param {String} eventType
 * @param {Array}  extraParameters (Optional)
 */
Terminalizer.prototype._emit = function(eventType, extraParameters) {

  var self = this;

  // Default value for extraParameters
  if (typeof extraParameters == 'undefined') {
    extraParameters = [];
  }

  setTimeout(function() {
    self.$element.trigger(eventType, extraParameters);
  });
  
};

/**
 * Format time as MM:SS
 * 
 * @param  {Number} time time in ms
 * @return {Number}
 */
Terminalizer.prototype._formatTime = function(time) {

  var minutes = Math.floor(time / 60000);
  var seconds = parseInt((time - (minutes * 60000)) / 1000);

  if (minutes < 10) {
    minutes = '0' + minutes;
  }
  if (seconds < 10) {
    seconds = '0' + seconds;
  }

  return minutes + ':' + seconds;
  
};

/**
 * Execute a set of async tasks in sequence
 * 
 * @param {Array}    tasks
 * @param {Function} callback
 */
Terminalizer.prototype._series = function(tasks, callback) {

  if (tasks.length == 0) {
    return callback(null);
  }

  var runTask = function(index) {

    tasks[index](function(error, result) {

      if (typeof error != 'undefined' && error) {
        return callback(error);
      }

      // All tasks have been executed
      if (index == tasks.length - 1) {
        return callback(null);
      }

      return runTask(index + 1);

    });

  };

  runTask(0);

};

/**
 * Get the number of frames
 * 
 * @return {Number}
 */
Terminalizer.prototype.getFramesCount = function() {

  return this._frames.length;
  
};

/**
 * Start/resume playing the frames
 *
 * @return {Promise}
 */
Terminalizer.prototype.play = function() {

  var self = this;

  return new Promise(function(resolve, reject) {

    // Reached the end or not started yet
    if ((self._lastRenderedFrame == self.getFramesCount() - 1 &&
         self._currentTime == self._totalDuration) || !self._isStarted) {

      self._currentTime = 0;

      // Set the _isStarted flag
      self._isStarted = true;

      // Reset the terminal
      self._terminal.reset();

      /**
       * A callback function for the event:
       * When the write operation is executed and
       * the changes are rendered
       */
      return self.$element.one('rendered', function() {
        resolve();
      });

    }

    resolve();

  }).then(function() {

    // Add started class
    self.$element.find('.terminalizer-player').addClass('started');

    // Set the _isPlaying flag
    self._isPlaying = true;

    // Emit the event on the Terminalizer element
    self._emit('playingStarted');
  
    // Add playing class
    self.$element.find('.terminalizer-player').addClass('playing');
  
  });

};

/**
 * Pause playing the frames
 */
Terminalizer.prototype.pause = function() {

  // Unset the _isPlaying flag
  this._isPlaying = false;

  // Remove playing class
  this.$element.find('.terminalizer-player').removeClass('playing');

  // Emit the event on the Terminalizer element
  this._emit('playingPaused');
  
};

/**
 * Change the current time of the player
 *
 * @param  {Number}  time
 * @param  {Boolean} updatePlayer if false, just render the frame
 *                                without setting `_currentTime` and
 *                                without calling `updatePlayer()`
 *                                (Optional) (Default: true)
 * @return {Promise}
 */
Terminalizer.prototype.jump = function(time, updatePlayer) {

  var self = this;
  var tasks = [];

  // The frame to jump to
  var frameIndex = null;

  // Is currently playing
  var isPlaying = self._isPlaying;

  // Default value for updatePlayer
  if (typeof updatePlayer == 'undefined') {
    updatePlayer = true;
  }

  // The start point of the rendering cycle
  self._isRendering = true;
  self._isPlaying = false;

  if (updatePlayer) {

    // Set the current time to the time of the frame
    self._currentTime = time;

    // Update the player (time and progressbar)
    self._updatePlayer();
    
  }

  return new Promise(function(resolve, reject) {

    /**
     * A callback function for the event:
     * When the write operation is executed and
     * the changes are rendered
     */
    self.$element.one('rendered', function() {

      // Get the frame's index
      frameIndex = self._findFrameAt(time);

      // Foreach frame <= the frame to jump too
      for (var i = 0; i <= frameIndex; i++) {
        self._terminal.write(self._frames[i].content);
      }

      /**
       * A callback function for the event:
       * When the write operation is executed and
       * the changes are rendered
       */
      self.$element.one('rendered', function() {

        // The end point of the rendering cycle
        self._isRendering = false;
        self._isPlaying = isPlaying;

        resolve();

      });

    });

    // Reset the terminal
    self._terminal.reset();

  });
  
};
