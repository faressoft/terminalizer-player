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
   * in the format [{content, delay}, ...]
   * @type {Object}
   */
  self._frames = null;

  /**
   * Terminal buffer snapshots (cached frames)
   * in the format [{lines, cursorX, cursorY, cursorHidden, startTime, endTime, delay}, ..]
   * @type {Array}
   */
  self._snapshots = [];

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
   * Is blocked for the rendering
   * @type {Boolean}
   */
  self._isRendering = false;

  /**
   * The index of the last rendered frame
   * @type {Number}
   */
  self._lastRenderedFrame = -1;

  /**
   * A backup for the setTimeout native function
   * @type {Function}
   */
  self._setTimeoutBackup = setTimeout;

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
    '<div class="loading"><div></div><div></div><div></div><div></div></div>' +
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
    autoplay: false
  }, options);

  // Initialize Terminalizer
  self._init().then(function(result) {
  
    // Initialize the controller
    return self._initController();
  
  }).then(function() {

    // Emit the event on the Terminalizer element
    self._emit('init');

    // Autoplay is enabled
    if (self._options.autoplay) {
      self.play();
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

    // Show the thumbnail
    if (typeof result.thumbnail != 'undefined') {
      self._applySnapshot(result.thumbnail, true);
    }

    // Add a watermark
    if (self._options.watermark.imagePath) {
      return self._addWatermark(self._options.watermark);
    }

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
   * When click the progressbar is clicked
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
   * When click the play button is clicked
   * 
   * @param {Object} event
   */
  self.$element.find('.cover, .start').on('click', function(event) {

    self.play();
    return false;

  });
  
  /**
   * A callback function for the event:
   * When click the play button is clicked
   * 
   * @param {Object} event
   */
  self.$element.find('.controller .play').on('click', function(event) {

    self.play();
    return false;

  });
  
  /**
   * A callback function for the event:
   * When click the pause button is clicked
   * 
   * @param {Object} event
   */
  self.$element.find('.controller .pause').on('click', function(event) {

    self.pause();
    return false;

  });
  
};

/**
 * Initialize the player for the first playing
 *
 * - Resolve immediately if already started
 *
 * @return {Promise}
 */
Terminalizer.prototype._start = function() {

  var self = this;

  // Already started
  if (self._isStarted) {
    return Promise.resolve();
  }

  // Pause rendering
  self._terminal._core.renderer._isPaused = true;

  // Add loading class
  self.$element.find('.terminalizer-player').addClass('loading');

  // Hide the terminal
  self.$element.find('.terminalizer-body').css('visibility', 'hidden');

  // Adjust the delays of the frames, considering to the options
  self._adjustDelays();

  // Sum the adjusted frames delays
  self._totalDuration = self._calculateTotalDuration();

  // Cache the viewport
  return self._generateSnapshots().then(function(result) {

    // Unpause rendering
    self._terminal._core.renderer._isPaused = false;
  
    // Show the terminal
    self.$element.find('.terminalizer-body').css('visibility', 'visible');

    // Add started class
    self.$element.find('.terminalizer-player').addClass('started');

    // Start the playing timer
    self._lastTickTime = Date.now();
    self._timer = setInterval(self._tick.bind(self), 1);

    // Set the _isStarted flag
    self._isStarted = true;

    // Remove loading class
    self.$element.find('.terminalizer-player').removeClass('loading');
  
  }).catch(function(error) {
  
    console.log(error);      
    
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
 * Play the frames ang take snapshots for the terminal buffer
 * for each frame and calculate `startTime`, `endTime`, and `delay`
 *
 * @return {Promise}
 */
Terminalizer.prototype._generateSnapshots = function() {

  var self = this;
  var tasks = [];
  var currentDuration = 0;
  var chunkSize = 200;
  var chunkDelay = 2;

  // A workaround for sync rendering with xterm
  self._syncSetTimeout();

  // Reset the terminal
  self._terminal.reset();

  // Foreach frame
  self._frames.forEach(function(frame, index) {

    var delay = 0;

    if (index > 0 && index % chunkSize == 0) {
      delay = chunkDelay;
    }

    tasks.push(function(callback) {

      setTimeout(function() {

        // Render the frame
        self._terminal.write(frame.content);

        // Take a snapshot
        self._snapshots.push({
          lines: $.extend(true, {}, self._terminal._core.buffer.lines),
          cursorX: self._terminal._core.buffer.x,
          cursorY: self._terminal._core.buffer.y,
          cursorHidden: self._terminal._core.cursorHidden,
          startTime: currentDuration,
          endTime: currentDuration + frame.delay,
          delay: frame.delay
        });

        currentDuration = currentDuration + frame.delay;
        
        callback();

      }, delay);
      
    });

  });

  return new Promise(function(resolve, reject) {

    setTimeout(function() {
      
      self._series(tasks, function(error, result) {

        // Reset the overriden setTimeout to the native one
        self._resetSetTimeout();

        // Reset the terminal
        self._terminal.reset();

        resolve();
        
      });

    }, 10);

  });

};

/**
 * Get the frame's index at a specific time
 * 
 * @param  {Number} time
 * @param  {Number} fromIndex (default: 0)
 * @return {Number}
 */
Terminalizer.prototype._findFrameAt = function(time, fromIndex) {

  var snapshot = null;

  // Default value for fromIndex
  if (typeof fromIndex == 'undefined') {
    fromIndex = 0;
  }

  // Foreach snapshot
  for (var i = fromIndex; i < this._snapshots.length; i++) {

    snapshot = this._snapshots[i];

    if (snapshot.startTime <= time && time < snapshot.endTime) {
      return i;
    }

  }

  // The endTime of the final frame belongs to it
  if (snapshot.startTime <= time && time <= snapshot.endTime) {
    return this._snapshots.length - 1;
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

  var snapshot = this._snapshots[frameIndex];

  if (typeof snapshot == 'undefined') {
    return false;
  }

  if (snapshot.startTime <= time && time < snapshot.endTime) {
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
 * Update the terminal buffer using the a snapshot
 *
 * - Set lines
 * - Set x of the cursor
 * - Set y of the cursor
 * - Set cursorState to 1
 * - Set cursorHidden
 * - Refresh the terminal
 * 
 * @param {Object}  snapshot     {lines, cursorX, cursorY, cursorHidden}
 * @param {Boolean} cursorHidden override the snapshot's value of cursorHidden (Optional)
 */
Terminalizer.prototype._applySnapshot = function(snapshot, cursorHidden) {

  // Default value for cursorHidden 
  if (typeof cursorHidden == 'undefined') {
    cursorHidden = snapshot.cursorHidden;
  }

  this._terminal._core.buffer.lines = Object.assign(this._terminal._core.buffer.lines, snapshot.lines);
  this._terminal._core.buffer.x = snapshot.cursorX;
  this._terminal._core.buffer.y = snapshot.cursorY;
  this._terminal._core.cursorState = 1;
  this._terminal._core.cursorHidden = cursorHidden;
  this._terminal.refresh();
  
};

/**
 * Render a frame
 *
 * - Render the corresponding snapshot
 * 
 * @param {Number}   frameIndex
 * @param {Function} callback
 */
Terminalizer.prototype._renderFrame = function(frameIndex, callback) {

  var self = this;
  var tasks = [];
  var snapshot = self._snapshots[frameIndex];
  var frame = self._frames[frameIndex];

  // If beforeMiddleware is set
  if (self._options.beforeMiddleware) {

    tasks.push(function(callback) {
      self._options.beforeMiddleware.call(self, frame, frameIndex, callback.bind(null, null, null));
    });

  }

  // Rendering
  tasks.push(function(callback) {

    self._applySnapshot(snapshot);
    callback();

  });

  // If afterMiddleware is set
  if (self._options.afterMiddleware) {

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
 * The timer's callback
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

  // Stil rendering the last frame
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
  if (self._lastRenderedFrame == self.getFramesCount() - 1 &&
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
  self._renderFrame(self._lastRenderedFrame, function() {

    // To discard the time spent rendering
    self._lastTickTime = Date.now();

    // The end point of the rendering cycle
    self._isRendering = false;

  });

};

/**
 * Update the player
 *
 * - Update the time
 * - Update the progressbar
 */
Terminalizer.prototype._updatePlayer = function() {

  var progress = parseInt(this._currentTime / this._totalDuration * 100);
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

  // Default value for extraParameters
  if (typeof extraParameters == 'undefined') {
    extraParameters = [];
  }

  this.$element.trigger(eventType, extraParameters);
  
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
 * Override setTimeout to make it sync when the `delay` is `0`
 * A workaround for sync rendering with xterm
 */
Terminalizer.prototype._syncSetTimeout = function() {

  var self = this;

  setTimeout = function() {

    var callback = arguments[0];
    var delay = 0;
    var args = Array.prototype.slice.call(arguments, 2);

    if (typeof arguments[1] != 'undefined') {
      delay = arguments[1];
    }

    if (delay <= 1) {
      return callback.apply(this, args);
    }

    self._setTimeoutBackup.bind(this, callback, delay).apply(null, args);
    
  };

};

/**
 * Reset the overriden setTimeout to the native one
 */
Terminalizer.prototype._resetSetTimeout = function() {

  setTimeout = this._setTimeoutBackup;

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
 * Resume playing the frames
 *
 * @return {Promise}
 */
Terminalizer.prototype.play = function() {

  var self = this;

  return self._start().then(function(result) {

    // Reached the end
    if (self._lastRenderedFrame == self.getFramesCount() - 1 &&
        self._currentTime == self._totalDuration) {

      self._currentTime = 0;

    }
  
    // Set the _isPlaying flag
    self._isPlaying = true;

    // Add playing class
    self.$element.find('.terminalizer-player').addClass('playing');

    // Emit the event on the Terminalizer element
    self._emit('playingStarted');
  
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
 * - Don't do anything if the player is not playing
 *
 * @param {Number} time
 */
Terminalizer.prototype.jump = function(time) {

  // Not playing
  if (!this._isPlaying) {
    return;
  }

  this._currentTime = time;
  
};
