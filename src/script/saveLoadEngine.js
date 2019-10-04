import TemplateSelector from 'pedigree/view/templateSelector';

/**
 * SaveLoadEngine is responsible for automatic and manual save and load operations.
 *
 * @class SaveLoadEngine
 * @constructor
 */

function unescapeRestData (data) {
  // http://stackoverflow.com/questions/4480757/how-do-i-unescape-html-entities-in-js-change-lt-to
  var tempNode = document.createElement('div');
  tempNode.innerHTML = data.replace(/&amp;/, '&');
  return tempNode.innerText || tempNode.text || tempNode.textContent;
}

function getSelectorFromXML(responseXML, selectorName, attributeName, attributeValue) {
  if (responseXML.querySelector) {
    // modern browsers
    return responseXML.querySelector(selectorName + '[' + attributeName + '=\'' + attributeValue + '\']');
  } else {
    // IE7 && IE8 && some other older browsers
    // http://www.w3schools.com/XPath/xpath_syntax.asp
    // http://msdn.microsoft.com/en-us/library/ms757846%28v=vs.85%29.aspx
    var query = '//' + selectorName + '[@' + attributeName + '=\'' + attributeValue + '\']';
    try {
      return responseXML.selectSingleNode(query);
    } catch (e) {
      // Firefox v3.0-
      alert('your browser is unsupported');
      window.stop && window.stop();
      throw 'Unsupported browser';
    }
  }
}

function getSubSelectorTextFromXML(responseXML, selectorName, attributeName, attributeValue, subselectorName) {
  var selector = getSelectorFromXML(responseXML, selectorName, attributeName, attributeValue);

  var value = selector.innerText || selector.text || selector.textContent;

  if (!value)     // fix IE behavior where (undefined || "" || undefined) == undefined
  {
    value = '';
  }

  return value;
}

var SaveLoadEngine = Class.create( {

  initialize: function() {
    this._saveInProgress = false;
  },

  /**
     * Saves the state of the graph
     *
     * @return Serialization data for the entire graph
     */
  serialize: function() {
    return editor.getGraph().toJSON();
  },

  createGraphFromSerializedData: function(JSONString, noUndo, centerAround0) {
    console.log('---- load: parsing data ----');
    document.fire('pedigree:load:start');

    try {
      var changeSet = editor.getGraph().fromJSON(JSONString);
    } catch(err) {
      console.log('ERROR loading the graph: ', err);
      alert('Error loading the graph');
      document.fire('pedigree:graph:clear');
      document.fire('pedigree:load:finish');
      return;
    }

    if (editor.getView().applyChanges(changeSet, false)) {
      editor.getWorkspace().adjustSizeToScreen();
    }

    if (centerAround0) {
      editor.getWorkspace().centerAroundNode(0);
    }

    if (!noUndo) {
      editor.getActionStack().addState(null, null, JSONString);
    }

    document.fire('pedigree:load:finish');
  },

  createGraphFromImportData: function(importString, importType, importOptions, noUndo, centerAround0) {
    console.log('---- import: parsing data ----');
    document.fire('pedigree:load:start');

    try {
      var changeSet = editor.getGraph().fromImport(importString, importType, importOptions);
      if (changeSet == null) {
        throw 'unable to create a pedigree from imported data';
      }
    } catch(err) {
      alert('Error importing pedigree: ' + err);
      document.fire('pedigree:load:finish');
      return;
    }

    if (!noUndo) {
      var JSONString = editor.getGraph().toJSON();
    }

    if (editor.getView().applyChanges(changeSet, false)) {
      editor.getWorkspace().adjustSizeToScreen();
    }

    if (centerAround0) {
      editor.getWorkspace().centerAroundNode(0);
    }

    if (!noUndo) {
      editor.getActionStack().addState(null, null, JSONString);
    }

    document.fire('pedigree:load:finish');
  },

  save: function(patientDataUrl) {
    if (this._saveInProgress) {
      return;
    }   // Don't send parallel save requests

    var me = this;

    var jsonData = this.serialize();

    console.log('[SAVE] data: ' + JSON.stringify(jsonData));

    var image = $('canvas');
    var background = image.getElementsByClassName('panning-background')[0];
    var backgroundPosition = background.nextSibling;
    var backgroundParent =  background.parentNode;
    backgroundParent.removeChild(background);
    var bbox = image.down().getBBox();
    new Ajax.Request(patientDataUrl, {
      method: 'POST',
      onCreate: function() {
        me._saveInProgress = true;
      },
      onComplete: function() {
        me._saveInProgress = false;
      },
      onSuccess: function() {},
      parameters: {'property#data': jsonData, 'property#image': image.innerHTML.replace(/xmlns:xlink=".*?"/, '').replace(/width=".*?"/, '').replace(/height=".*?"/, '').replace(/viewBox=".*?"/, 'viewBox="' + bbox.x + ' ' + bbox.y + ' ' + bbox.width + ' ' + bbox.height + '" width="' + bbox.width + '" height="' + bbox.height + '" xmlns:xlink="http://www.w3.org/1999/xlink"')}
    });
    backgroundParent.insertBefore(background, backgroundPosition);
  },

  load: function(patientDataUrl) {
    console.log('initiating load process');
    var _this = this;
    var didLoadData = false;
    if (patientDataUrl) {
      new Ajax.Request(patientDataUrl, {
        method: 'GET',
        onCreate: function() {
          document.fire('pedigree:load:start');
        },
        onSuccess: function(response) {
          //console.log("Data from LOAD: " + JSON.stringify(response));
          //console.log("[Data from LOAD]");
          if (response && response.responseXML) {
            var rawdata  = getSubSelectorTextFromXML(response.responseXML, 'property', 'name', 'data', 'value');
            var jsonData = unescapeRestData(rawdata);
            if (jsonData.trim()) {
              console.log('[LOAD] recived JSON: ' + JSON.stringify(jsonData));

              jsonData = editor.getVersionUpdater().updateToCurrentVersion(jsonData);

              _this.createGraphFromSerializedData(jsonData);

              didLoadData = true;
            }
          }
        },
        onComplete: function() {
          if (!didLoadData) {
            // If load failed, just open templates
            new TemplateSelector(true);
          }
        }
      });
    } else {
      new TemplateSelector(true);
    }
  }
});

export default SaveLoadEngine;
