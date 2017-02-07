/*global H5P*/
LongTextQuestion = (function ($, Question) {
  /**
   * Initialize module.
   *
   * @class H5P.LongTextQuestion
   * @extends H5P.Question
   * @param {Params} params
   * @param {number} id Content identification
   * @param {Object} contentData Task specific content data
   */
  function LongTextQuestion(params, id, contentData) {
    var self = this;

    // Inheritance
    Question.call(self, 'long-text-question');

    // IDs
    self.contentId = id;

    self.params = $.extend(true, {}, {
      text: "To be or not to be?",
      input: { 
        placeholderText: "Enter your answer here.",
        rows: 5,
      },
      submitSave: {
        showSubmit: false,
        submitText: "Your answer has been submitted.",
        autoSave: 0
      },
      rubric: {
        visibleToUser: false,
        criteria: [],
        label: "Rubric"
      },
      overrideSettings: {}
    }, params);
    
    // Previous state
    if (contentData !== undefined && contentData.previousState !== undefined && contentData.previousState.length > 0) {
      if (contentData.previousState.constructor === Array) {
        if (contentData.previousState[0].length > 0)
          self.previousState = contentData.previousState[0];
      }
      else {
        self.previousState = contentData.previousState;
      }
    }
    
    self.submitted = false;
    if (!!this.previousState) { 
      // Extract submitted status from answer text. This is a bit of a hack to get around the limitations of the xAPI scheme and H5P.
      var cleanAnswer = self.previousState.replace(/{submitted}/g, "");
      if (cleanAnswer.length != self.previousState.length) {
        self.submitted = true;
        self.previousState = cleanAnswer;
      }
    }
    
    // Get a reference to the media element, if present, once the content has been attached.
    // And show/hide the question/answer section as appropriate.
    H5P.externalDispatcher.once('domChanged', function (event) {
      if (event.data.library == "LongTextQuestion") {
        self.$media = event.data.$target.find('.h5p-question-image, .h5p-question-video');

        if (!self.previousState) {
          self.showQuestion();
        }
        else {
          self.showAnswer();
        }
      }
    });
  }

  // Inheritance
  LongTextQuestion.prototype = Object.create(Question.prototype);
  LongTextQuestion.prototype.constructor = LongTextQuestion;
  

  /**
   * Registers this question type's DOM elements before they are attached.
   * Called from H5P.Question.
   */
  LongTextQuestion.prototype.registerDomElements = function () {
    var self = this;
    
    // Register task content area.
    self.setContent(self.createContent());
    
    // Check for task media
    var media = self.params.media;
    if (media && media.library) {
      var type = media.library.split(' ')[0];
      if (type === 'H5P.Image') {
        if (media.params.file) {
          // Register task image
          self.setImage(media.params.file.path, {
            alt: media.params.alt
          });
        }
      }
      else if (type === 'H5P.Video') {
        if (media.params.sources) {
          // Register task video
          self.setVideo(media);
        }
      }
    }
    
    // Register buttons.
    self.registerButtons();
    
    // Restore previous state.
    self.setH5PUserState();
  };
  
  LongTextQuestion.prototype.showQuestion = function () {
    var self = this;
    self.hideButton('show-question');
    self.showButton('show-input');
    self.hideButton('submit-answer');
    self.$inputContainer.hide();
    self.$media.show();
    self.$questionContainer.show();
  };
  
  LongTextQuestion.prototype.showAnswer = function () {
    var self = this;
    self.hideButton('show-input');
    self.showButton('show-question');
    if (self.params.submitSave.showSubmit && !self.submitted) 
      self.showButton('submit-answer');
    self.$questionContainer.hide();
    self.$media.hide();
    self.$inputContainer.show();
  };
  
  /**
   * Create all the buttons for the task.
   */
  LongTextQuestion.prototype.registerButtons = function () {
    var self = this;
    
    // Show question text button.
    self.addButton('show-question', "View Question", function () {
      self.showQuestion();
    });
    
    // Show answer input button.
    self.addButton('show-input', "Answer", function () {
      self.showAnswer();
    });
    
    if (self.params.submitSave.showSubmit && !self.submitted) {
      // Submit answer button.
      self.addButton('submit-answer', "Submit", function () {
        self.submitted = true;
        
        // Trigger submission xAPI event.
        self.triggerxAPI(true);
        
        // Disable further editing.
        self.$userAnswerField.attr("disabled","disabled");
        
        self.hideButton('submit-answer');
      }, true, {}, {
        confirmationDialog: {
          enable: true,
          l10n: {
            header: "Are you sure?",
            body: "Are you sure you want to submit your answer? Further editing will not be possible."
          },
          instance: self.params.overrideSettings.instance,
          $parentElement: self.params.overrideSettings.$confirmationDialogParent
        }
      });
    }
  };
  
  /**
   * Create input area for answer.
   *
   * @param {number} lines Lines of input
   * @param {string} [placeholderString] Optional placeholder
   * @return {Element} The input element
   */
  LongTextQuestion.prototype.createContent = function () {
    var self = this;
    
    var $text = $('<div/>').addClass('text').html(self.params.text);
    self.$questionContainer = $('<div/>').append($text);
    
    if (!!self.params.rubric.visibleToUser && self.params.rubric.criteria.length > 0) {
      var $rubric = $('<div/>').addClass('rubric');
      
      if (!!self.params.rubric.label) {
        $rubric.append($('<h3/>').html(self.params.rubric.label));
      }
      
      var $rubricCriteria = $('<ul/>');
      for (var i = 0; i < self.params.rubric.criteria.length; i++) {
        var $criterion = $('<li/>');
        $criterion.append($('<div/>').addClass("weight").text("(" + self.params.rubric.criteria[i].weight + ")"));
        $criterion.append($('<div/>').addClass("text").html(self.params.rubric.criteria[i].text));
        $rubricCriteria.append($criterion);
      }
      $rubric.append($rubricCriteria);
      
      self.$questionContainer.append($rubric);
    }
    
    const input = document.createElement('textarea');
    input.placeholder = self.params.input.placeholderText;
    input.rows = self.params.input.rows;
    input.style.resize = 'none';
    self.$userAnswerField = $(input);
    self.$userAnswerField.addClass('user-input');
    if (self.submitted) {
      self.$userAnswerField.attr("disabled", "disabled");
    }
    else {
      // If a previously used value was loaded then initialise auto save with this value so we don't save it unnecessarily. 
      self.autoSavePreviousVal = self.previousState || "";

      var save = function() {
        // Trigger 'responded' xAPI event.
        self.triggerxAPI(false);
        self.autoSavePreviousVal = self.$userAnswerField.val();
      }
      
      var autoSave = function(timed) {
        // Cancel existing timeout (if it already transpired then this is a no-op).
        if (self.autoSaveTimeout) {
          window.clearTimeout(self.autoSaveTimeout);
        }
        
        if (!self.submitted) {
          if (self.$userAnswerField.val() != self.autoSavePreviousVal) {
            if (timed) {
              self.autoSaveTimeout = window.setTimeout(save, self.params.submitSave.autoSave * 1000);
            }
            else {
              save();
            }
          }
        }
      }
      
      // If specified, auto-save after X seconds after a text change.
      if (self.params.submitSave.autoSave > 0) {
        self.$userAnswerField.on("input change keyup paste", function () { autoSave(true); });
      }
      
      // If specified, auto save when exit textarea.
      if (self.params.submitSave.autoSave >= 0) {
        self.$userAnswerField.blur(function () { autoSave(false); });
      }
    }
    
    self.$autosaveMessage = $('<div/>').addClass('autosave-status').html("&nbsp;");
    self.$submitMessage = $('<div/>').addClass('submit-message');
    
    self.$inputContainer = $('<div/>').append(self.$userAnswerField).append(self.$autosaveMessage).append(self.$submitMessage);
    
    var $container = $('<div/>').append(self.$questionContainer).append(self.$inputContainer);
    
    return $container;
  };
  

  /**
   * Trigger xAPI answered event.
   */
  LongTextQuestion.prototype.triggerxAPI = function(isSubmit) {
    var xAPIEvent = this.generateXAPIData(isSubmit);
    this.trigger(xAPIEvent);
    
    function checkTime(i) {
      return (i < 10) ? "0" + i : i;
    }
    var now = new Date(),
        h = checkTime(now.getHours()),
        m = checkTime(now.getMinutes()),
        s = checkTime(now.getSeconds());

    this.$autosaveMessage.html((isSubmit ? "Submitted" : "Last saved") + " at " + h + ":" + m + ":" + s + ".");
    if (isSubmit) {
      this.$submitMessage.html(this.params.submitText);
      
    }
  };

  /**
   * Get xAPI data.
   * Contract used by report rendering engine.
   *
   * @see contract at {@link https://h5p.org/documentation/developers/contracts#guides-header-6}
   */
  LongTextQuestion.prototype.getXAPIData = function () {
    var xAPIEvent = this.generateXAPIData(false);
    return {
      statement: xAPIEvent.data.statement
    }
  };

  /**
   * Generate xAPI data. Intended for internal use.
   * @param {Boolean} isSubmit True iff the data is for a final submission event (eg the Submit button being clicked). 
   */
  LongTextQuestion.prototype.generateXAPIData = function (isSubmit) {
    var verb = !!isSubmit ? 'answered' : (this.getAnswerGiven() ? 'responded' : 'initialized');
    var xAPIEvent = this.createXAPIEventTemplate(verb);
    this.addQuestionToXAPI(xAPIEvent);
    this.addResponseToXAPI(xAPIEvent);
    return xAPIEvent;
  };

  /**
   * Generate xAPI object definition used in xAPI statements.
   * @return {Object}
   */
  LongTextQuestion.prototype.getxAPIDefinition = function () {
    var definition = {};
    definition.description = {
      'en-US': this.params.text
    };
    definition.type = 'http://adlnet.gov/expapi/activities/cmi.interaction';
    definition.interactionType = 'long-fill-in';
    definition.correctResponsesPattern = [];
    return definition;
  };

  /**
   * Add the question itselt to the definition part of an xAPIEvent
   */
  LongTextQuestion.prototype.addQuestionToXAPI = function(xAPIEvent) {
    var definition = xAPIEvent.getVerifiedStatementValue(['object', 'definition']);
    $.extend(definition, this.getxAPIDefinition());
  };

  /**
   * Add the response part to an xAPI event
   *
   * @param {H5P.XAPIEvent} xAPIEvent
   *  The xAPI event we will add a response to
   */
  LongTextQuestion.prototype.addResponseToXAPI = function (xAPIEvent) {
    //xAPIEvent.setScoredResult(this.getScore(), this.getMaxScore(), this);
    xAPIEvent.data.statement.result = xAPIEvent.data.statement.result || {};
    xAPIEvent.data.statement.result.response = this.getxAPIResponse();
  };

  /**
   * Generate xAPI user response, used in xAPI statements.
   * @return {string} Text entered into the input field.
   */
  LongTextQuestion.prototype.getxAPIResponse = function () {
    return this.$userAnswerField.val() + (this.submitted ? "{submitted}" : "");
  };
  

  LongTextQuestion.prototype.getTitle = function() {
    return H5P.createTitle(this.params.text);
  };

  /**
   * Returns true iff the input field is not empty.
   *
   * @returns {Boolean}
   */
  LongTextQuestion.prototype.getAnswerGiven = function () {
    return this.$userAnswerField.val() != '';
  };

  
  /**
   * Sets answers to current user state
   */
  LongTextQuestion.prototype.setH5PUserState = function () {
    var self = this;
    var isValidState = this.previousState !== undefined;

    // Check that stored user state is valid
    if (!isValidState) {
      return;
    }
    
    this.$userAnswerField.val(this.previousState);
  };

  return LongTextQuestion;
})(H5P.jQuery, H5P.Question);
