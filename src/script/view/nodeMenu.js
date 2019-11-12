import Disorder from 'pedigree/disorder';
import HPOTerm from 'pedigree/hpoTerm';
import Helpers from 'pedigree/model/helpers';
import GraphicHelpers from 'pedigree/view/graphicHelpers';
import AgeCalc from 'pedigree/view/ageCalc';

/**
 * NodeMenu is a UI Element containing options for AbstractNode elements
 *
 * @class NodeMenu
 * @constructor
 * @param {Array} data Contains objects corresponding to different menu items
 *
 {
 [
    {
        'name' : the name of the menu item,
        'label' : the text label above this menu option,
        'type' : the type of form input. (eg. 'radio', 'date-picker', 'text', 'textarea', 'disease-picker', 'select'),
        'values' : [
                    {'actual' : actual value of the option, 'displayed' : the way the option will be seen in the menu} ...
                    ]
    }, ...
 ]
 }

 Note: when an item is specified as "inactive" it is completely removed from the menu; when it
       is specified as "disabled" it is greyed-out and does not allow selection, but is still visible.
 */

var SELECTIZE_DELIMITER = '|';

var NodeMenu = Class.create({
  initialize : function(data, tabs, otherCSSClass) {
    this.canvas = editor.getWorkspace().canvas || $('body');
    var cssClass = 'menu-box';
    if (otherCSSClass) {
      cssClass += ' ' + otherCSSClass;
    }
    this.menuBox = new Element('div', {'class' : cssClass});

    this.closeButton = new Element('span', {'class' : 'close-button'}).update('×');
    this.menuBox.insert({'top': this.closeButton});
    this.closeButton.observe('click', this.hide.bindAsEventListener(this));

    this.form = new Element('form', {'method' : 'get', 'action' : '', 'class': 'tabs-content'});

    this.tabs = {};
    this.tabHeaders = {};
    if (tabs && tabs.length > 0) {
      this.tabTop = new Element('dl', {'class':'tabs'});
      for (var i = 0; i < tabs.length; i++) {
        var tabName = tabs[i];
        var activeClass = (i == 0) ? 'active' : '';
        this.tabs[tabName] = new Element('div', {'id': 'tab_' + tabName, 'class': 'content ' + activeClass});
        this.form.insert(this.tabs[tabName]);

        this.tabHeaders[tabName] = new Element('dd', {'class': activeClass}).insert('<a>' + tabName + '</a>');
        var _this = this;
        var switchTab = function(tabName) {
          return function() {
            for (var tab in _this.tabs) {
              if (_this.tabs.hasOwnProperty(tab)) {
                if (tab != tabName) {
                  _this.tabs[tab].className = 'content';
                  _this.tabHeaders[tab].className = '';
                } else {
                  _this.tabs[tab].className = 'content active';
                  _this.tabHeaders[tab].className = 'active';
                }
              }
            }
            _this.reposition();
          };
        };
        this.tabHeaders[tabName].observe('click', switchTab(tabName));
        this.tabTop.insert(this.tabHeaders[tabName]);
      }
      var div = new Element('div', {'class': 'tabholder'}).insert(this.tabTop).insert(this.form);
      this.menuBox.insert({'bottom' : div});
    } else {
      this.singleTab = new Element('div', {'class': 'tabholder'}).insert(this.form);
      this.menuBox.insert({'bottom' : this.singleTab});
      this.closeButton.addClassName('close-button-old');
      this.form.addClassName('content');
    }

    this.fieldMap = {};
    // Generate fields
    var _this = this;
    data.each(function(d) {
      if (typeof (_this._generateField[d.type]) == 'function') {
        var insertLocation = _this.form;
        if (d.tab && _this.tabs.hasOwnProperty(d.tab)) {
          insertLocation = _this.tabs[d.tab];
        }
        insertLocation.insert(_this._generateField[d.type].call(_this, d));
      }
    });

    // Insert in document
    this.hide();
    editor.getWorkspace().getWorkArea().insert(this.menuBox);

    this._onClickOutside = this._onClickOutside.bindAsEventListener(this);

    // Attach pickers
    // date
    var crtYear = new Date().getFullYear();
    window.dateTimePicker = new XWiki.widgets.DateTimePicker({
      year_range: [crtYear - 99, crtYear + 1],
      after_navigate : function(date) {
        this._selector.updateSelectedDate({day: date.getDate(), month: date.getMonth(), year : date.getYear() + 1900}, false);
      }
    });

    var _createSuggest = function(input) {
      var jqnode = jQuery(input);
      if (jqnode) {
        jqnode.selectize({
          options: [],
          create: true,
          sortField: 'text',
          persist: true,
          maxItems: null,
          delimiter: SELECTIZE_DELIMITER
        }).on('change', function(value) {
          Event.fire(input, 'xwiki:customchange');
        });
      }
      return jqnode;
    };

    // disease
    this.form.select('select.suggest-omim').each(function(item) {
      if (!item.hasClassName('initialized')) {
        _createSuggest(item);
        item.addClassName('initialized');
      }
    });

    // genes
    this.form.select('select.suggest-genes').each(function(item) {
      if (!item.hasClassName('initialized')) {
        _createSuggest(item);
        item.addClassName('initialized');
      }
    });

    // HPO terms
    this.form.select('select.suggest-hpo').each(function(item) {
      if (!item.hasClassName('initialized')) {
        _createSuggest(item);
        item.addClassName('initialized');
      }
    });

    // Update disorder colors
    this._updateDisorderColor = function(id, color) {
      this.menuBox.select('.field-disorders li input[value="' + id + '"]').each(function(item) {
        var colorBubble = item.up('li').down('.disorder-color');
        if (!colorBubble) {
          colorBubble = new Element('span', {'class' : 'disorder-color'});
          item.up('li').insert({top : colorBubble});
        }
        colorBubble.setStyle({background : color});
      });
    }.bind(this);
    document.observe('disorder:color', function(event) {
      if (!event.memo || !event.memo.id || !event.memo.color) {
        return;
      }
      _this._updateDisorderColor(event.memo.id, event.memo.color);
    });

    // Update gene colors
    this._updateGeneColor = function(id, color) {
      this.menuBox.select('.field-candidate_genes li input[value="' + id + '"]').each(function(item) {
        var colorBubble = item.up('li').down('.disorder-color');
        if (!colorBubble) {
          colorBubble = new Element('span', {'class' : 'disorder-color'});
          item.up('li').insert({top : colorBubble});
        }
        colorBubble.setStyle({background : color});
      });
    }.bind(this);
    document.observe('gene:color', function(event) {
      if (!event.memo || !event.memo.id || !event.memo.color) {
        return;
      }
      _this._updateGeneColor(event.memo.id, event.memo.color);
    });
  },

  _generateEmptyField : function (data) {
    var result = new Element('div', {'class' : 'field-box field-' + data.name});
    var label = new Element('label', {'class' : 'field-name'}).update(data.label);
    result.inputsContainer = new Element('div', {'class' : 'field-inputs'});
    result.insert(label).insert(result.inputsContainer);
    this.fieldMap[data.name] = {
      'type' : data.type,
      'element' : result,
      'default' : data['default'] || '',
      'crtValue' : data['default'] || '',
      'function' : data['function'],
      'inactive' : false
    };
    return result;
  },

  _attachFieldEventListeners : function (field, eventNames, values) {
    var _this = this;
    eventNames.each(function(eventName) {
      field.observe(eventName, function(event) {
        if (_this._updating) {
          return;
        } // otherwise a field change triggers an update which triggers field change etc
        var target = _this.targetNode;
        if (!target) {
          console.log('Attempted to update field without focus on a node');
          return;
        }

        var newValue = field._getValue && field._getValue() || undefined;
        if (Array.isArray(newValue)) {
          _this.fieldMap[field.name].crtValue = newValue[0];
        } else {
          console.log('Received invalid field value ' + newValue + ' for field ' + field.name);
          return;
        }

        var method = _this.fieldMap[field.name]['function'];

        if (target.getSummary()[field.name].value == _this.fieldMap[field.name].crtValue) {
          return;
        }

        if (method.indexOf('set') == 0 && typeof(target[method]) == 'function') {
          var properties = {};
          properties[method] = _this.fieldMap[field.name].crtValue;
          var event = { 'nodeID': target.getID(), 'properties': properties };
          document.fire('pedigree:node:setproperty', event);
        } else {
          var properties = {};
          properties[method] = _this.fieldMap[field.name].crtValue;
          var event = { 'nodeID': target.getID(), 'modifications': properties };
          document.fire('pedigree:node:modify', event);
        }
        field.fire('pedigree:change');
      });
    });
  },

  update: function() {
    if (this.targetNode) {
      this._updating = true;   // needed to avoid infinite loop: update -> _attachFieldEventListeners -> update -> ...
      this._setCrtData(this.targetNode.getSummary());
      this.reposition();
      delete this._updating;
    }
  },

  _generateField : {
    'radio' : function (data) {
      var result = this._generateEmptyField(data);
      var columnClass = data.columns ? 'field-values-' + data.columns + '-columns' : 'field-values';
      var values = new Element('div', {'class' : columnClass});
      result.inputsContainer.insert(values);
      var _this = this;
      var _generateRadioButton = function(v) {
        var radioLabel = new Element('label', {'class' : data.name + '_' + v.actual}).update(v.displayed);
        var radioButton = new Element('input', {type: 'radio', name: data.name, value: v.actual});
        radioLabel.insert({'top': radioButton});
        radioButton._getValue = function() {
          return [this.value];
        }.bind(radioButton);
        values.insert(radioLabel);
        _this._attachFieldEventListeners(radioButton, ['click']);
      };
      data.values.each(_generateRadioButton);

      return result;
    },
    'checkbox' : function (data) {
      var result = this._generateEmptyField(data);
      var checkbox = new Element('input', {type: 'checkbox', name: data.name, value: '1'});
      result.down('label').insert({'top': checkbox});
      checkbox._getValue = function() {
        return [this.checked];
      }.bind(checkbox);
      this._attachFieldEventListeners(checkbox, ['click']);
      return result;
    },
    'text' : function (data) {
      var result = this._generateEmptyField(data);
      var text = new Element('input', {type: 'text', name: data.name});
      if (data.tip) {
        text.placeholder = data.tip;
      }
      result.inputsContainer.insert(text);
      text.wrap('span');
      text._getValue = function() {
        return [this.value];
      }.bind(text);
      //this._attachFieldEventListeners(text, ['keypress', 'keyup'], [true]);
      this._attachFieldEventListeners(text, ['keyup'], [true]);
      return result;
    },
    'textarea' : function (data) {
      var result = this._generateEmptyField(data);
      var properties = {name: data.name};
      properties['class'] = 'textarea-'+data.rows+'-rows'; // for compatibiloity with older browsers not accepting {class: ...}
      var text = new Element('textarea', properties);
      result.inputsContainer.insert(text);
      //text.wrap('span');
      text._getValue = function() {
        return [this.value];
      }.bind(text);
      this._attachFieldEventListeners(text, ['keyup'], [true]);
      return result;
    },
    'date-picker' : function (data) {
      var result = this._generateEmptyField(data);
      var datePicker = new Element('input', {type: 'text', 'class': 'xwiki-date', name: data.name, 'title': data.format, alt : '' });
      result.insert(datePicker);
      datePicker._getValue = function() {
        return [this.alt && Date.parseISO_8601(this.alt)];
      }.bind(datePicker);
      this._attachFieldEventListeners(datePicker, ['xwiki:date:changed']);
      return result;
    },
    'disease-picker' : function (data) {
      var result = this._generateEmptyField(data);
      var diseasePicker = new Element('select', {multiple: 'multiple', 'class': 'suggest-omim', name: data.name});
      result.insert(diseasePicker);
      diseasePicker._getValue = function() {
        var target = jQuery(this);
        if (target && target[0] && target[0].selectize) {
          var val = target[0].selectize.getValue();
          if (val) {
            return [val];
          } else {
            return [];
          }
        }
      }.bind(diseasePicker);
      this._attachFieldEventListeners(diseasePicker, ['xwiki:customchange']);
      return result;
    },
    'hpo-picker' : function (data) {
      var result = this._generateEmptyField(data);
      var hpoPicker = new Element('select', {multiple: 'multiple', 'class': 'suggest-hpo', name: data.name});
      result.insert(hpoPicker);
      hpoPicker._getValue = function() {
        var target = jQuery(this);
        if (target && target[0] && target[0].selectize) {
          var val = target[0].selectize.getValue();
          if (val) {
            return [val];
          } else {
            return [];
          }
        }
      }.bind(hpoPicker);
      this._attachFieldEventListeners(hpoPicker, ['xwiki:customchange']);
      return result;
    },
    'gene-picker' : function (data) {
      var result = this._generateEmptyField(data);
      var genePicker = new Element('select', {multiple: 'multiple', 'class': 'suggest-genes', name: data.name});
      result.insert(genePicker);
      genePicker._getValue = function() {
        var target = jQuery(this);
        if (target && target[0] && target[0].selectize) {
          var val = target[0].selectize.getValue();
          if (val) {
            return [val];
          } else {
            return [];
          }
        }
      }.bind(genePicker);
      this._attachFieldEventListeners(genePicker, ['xwiki:customchange']);
      return result;
    },
    'select' : function (data) {
      var result = this._generateEmptyField(data);
      var select = new Element('select', {'name' : data.name});
      result.inputsContainer.insert(select);
      select.wrap('span');
      var _generateSelectOption = function(v) {
        var option = new Element('option', {'value' : v.actual}).update(v.displayed);
        select.insert(option);
      };
      if(data.nullValue) {
        _generateSelectOption({'actual' : '', displayed : '-'});
      }
      if (data.values) {
        data.values.each(_generateSelectOption);
      } else if (data.range) {
        $A($R(data.range.start, data.range.end)).each(function(i) {
          _generateSelectOption({'actual': i, 'displayed' : i + ' ' + data.range.item[+(i!=1)]});
        });
      }
      select._getValue = function() {
        return [(this.selectedIndex >= 0) && this.options[this.selectedIndex].value || ''];
      }.bind(select);
      this._attachFieldEventListeners(select, ['change']);
      return result;
    },
    'hidden' : function (data) {
      var result = this._generateEmptyField(data);
      result.addClassName('hidden');
      var input = new Element('input', {type: 'hidden', name: data.name, value: ''});
      result.update(input);
      return result;
    }
  },

  show : function(node, x, y) {
    this._onscreen = true;
    this.targetNode = node;
    this._setCrtData(node.getSummary());
    this.menuBox.show();
    this.reposition(x, y);
    document.observe('mousedown', this._onClickOutside);
  },

  hide : function() {
    this.hideSuggestPicker();
    this._onscreen = false;
    document.stopObserving('mousedown', this._onClickOutside);
    if (this.targetNode) {
      this.targetNode.onWidgetHide();
      delete this.targetNode;
    }
    this.menuBox.hide();
    this._clearCrtData();
  },

  hideSuggestPicker: function() {
    this.form.select('select.suggest').each(function(item) {
      if (item._suggest) {
        item._suggest.clearSuggestions();
      }
    });
  },

  isVisible: function() {
    return this._onscreen;
  },

  _onClickOutside: function (event) {
    if (!event.findElement('.menu-box') && !event.findElement('.calendar_date_select') && !event.findElement('.suggestItems')) {
      this.hide();
    }
  },

  reposition : function(x, y) {
    x = Math.floor(x);
    if (x !== undefined && isFinite(x)) {
      if (this.canvas && x + this.menuBox.getWidth() > (this.canvas.getWidth() + 10)) {
        var delta = x + this.menuBox.getWidth() - this.canvas.getWidth();
        editor.getWorkspace().panByX(delta, true);
        x -= delta;
      }
      this.menuBox.style.left = x + 'px';
    }

    this.menuBox.style.height = '';
    var height = '';
    var top    = '';
    if (y !== undefined && isFinite(y)) {
      y = Math.floor(y);
    } else {
      if (this.menuBox.style.top.length > 0) {
        y  = parseInt(this.menuBox.style.top.match( /^(\d+)/g )[0]);
      }
      if (y === undefined || !isFinite(y) || y < 0) {
        y = 0;
      }
    }

    // Make sure the menu fits inside the screen
    if (this.canvas && this.menuBox.getHeight() >= (this.canvas.getHeight() - 1)) {
      // menu is too big to fit the screen
      top    = 0;
      height = (this.canvas.getHeight() - 1) + 'px';
    } else if (this.canvas.getHeight() < y + this.menuBox.getHeight() + 1) {
      // menu fits the screen, but have to move it higher for that
      var diff = y + this.menuBox.getHeight() - this.canvas.getHeight() + 1;
      var position = (y - diff);
      if (position < 0) {
        top    = 0;
        height = (this.canvas.getHeight() - 1) + 'px';
      } else {
        top    = position + 'px';
        height = '';
      }
    } else {
      top = y + 'px';
      height = '';
    }

    this.menuBox.style.top      = top;
    this.menuBox.style.height   = height;
    this.menuBox.style.overflow = 'auto';
  },

  _clearCrtData : function () {
    var _this = this;
    Object.keys(this.fieldMap).each(function (name) {
      _this.fieldMap[name].crtValue = _this.fieldMap[name]['default'];
      _this._setFieldValue[_this.fieldMap[name].type].call(_this, _this.fieldMap[name].element, _this.fieldMap[name].crtValue);
      _this.fieldMap[name].inactive = false;
    });
  },

  _setCrtData : function (data) {
    var _this = this;
    Object.keys(this.fieldMap).each(function (name) {
      _this.fieldMap[name].crtValue = data && data[name] && typeof(data[name].value) != 'undefined' ? data[name].value : _this.fieldMap[name].crtValue || _this.fieldMap[name]['default'];
      _this.fieldMap[name].inactive = (data && data[name] && (typeof(data[name].inactive) == 'boolean' || typeof(data[name].inactive) == 'object')) ? data[name].inactive : _this.fieldMap[name].inactive;
      _this.fieldMap[name].disabled = (data && data[name] && (typeof(data[name].disabled) == 'boolean' || typeof(data[name].disabled) == 'object')) ? data[name].disabled : _this.fieldMap[name].disabled;
      _this._setFieldValue[_this.fieldMap[name].type].call(_this, _this.fieldMap[name].element, _this.fieldMap[name].crtValue);
      _this._setFieldInactive[_this.fieldMap[name].type].call(_this, _this.fieldMap[name].element, _this.fieldMap[name].inactive);
      _this._setFieldDisabled[_this.fieldMap[name].type].call(_this, _this.fieldMap[name].element, _this.fieldMap[name].disabled);
    });
  },

  _setFieldValue : {
    'radio' : function (container, value) {
      var target = container.down('input[type=radio][value=' + value + ']');
      if (target) {
        target.checked = true;
      }
    },
    'checkbox' : function (container, value) {
      var checkbox = container.down('input[type=checkbox]');
      if (checkbox) {
        checkbox.checked = value;
      }
    },
    'text' : function (container, value) {
      var target = container.down('input[type=text]');
      if (target) {
        target.value = value;
      }
    },
    'textarea' : function (container, value) {
      var target = container.down('textarea');
      if (target) {
        target.value = value;
      }
    },
    'date-picker' : function (container, value) {
      var target = container.down('input[type=text].xwiki-date');
      if (target) {
        target.value = value && value.toFormattedString({'format_mask' : target.title}) || '';
        target.alt = value && value.toISO8601() || '';
      }
    },
    'disease-picker' : function (container, values) {
      var target = jQuery(container).find('select.suggest-omim');
      if (target && target[0] && target[0].selectize) {
        if (Array.isArray(values)) {
          var ids = [];
          // Diseases are an array of {id, value} objects
          values.forEach(function (value) {
            if (value && value.hasOwnProperty("id")) {
              ids.push(value.id);
            }
          })
          target[0].selectize.setValue(ids, true);
        }
      }
    },
    'hpo-picker' : function (container, values) {
      var target = jQuery(container).find('select.suggest-hpo');
      if (target && target[0] && target[0].selectize) {
        if (Array.isArray(values)) {
          var ids = [];
          // HPO terms are an array of {id, value} objects
          values.forEach(function (value) {
            if (value && value.hasOwnProperty("id")) {
              ids.push(value.id);
            }
          })
          target[0].selectize.setValue(ids, true);
        }
      }
    },
    'gene-picker' : function (container, values) {
      var target = jQuery(container).find('select.suggest-genes');
      if (target && target[0] && target[0].selectize) {
        if (Array.isArray(values)) {
          // Genes are just a straight array of strings
          target[0].selectize.setValue(values, true);
        }
      }
    },
    'select' : function (container, value) {
      var target = container.down('select option[value=' + value + ']');
      if (target) {
        target.selected = 'selected';
      }
    },
    'hidden' : function (container, value) {
      var target = container.down('input[type=hidden]');
      if (target) {
        target.value = value;
      }
    }
  },

  _toggleFieldVisibility : function(container, doHide) {
    if (doHide) {
      container.addClassName('hidden');
    } else {
      container.removeClassName('hidden');
    }
  },

  _setFieldInactive : {
    'radio' : function (container, inactive) {
      if (inactive === true) {
        container.addClassName('hidden');
      } else {
        container.removeClassName('hidden');
        container.select('input[type=radio]').each(function(item) {
          if (inactive && Object.prototype.toString.call(inactive) === '[object Array]') {
            item.disabled = (inactive.indexOf(item.value) >= 0);
            if (item.disabled) {
              item.up().addClassName('hidden');
            } else {
              item.up().removeClassName('hidden');
            }
          } else if (!inactive) {
            item.disabled = false;
            item.up().removeClassName('hidden');
          }
        });
      }
    },
    'checkbox' : function (container, inactive) {
      this._toggleFieldVisibility(container, inactive);
    },
    'text' : function (container, inactive) {
      this._toggleFieldVisibility(container, inactive);
    },
    'textarea' : function (container, inactive) {
      this._toggleFieldVisibility(container, inactive);
    },
    'date-picker' : function (container, inactive) {
      this._toggleFieldVisibility(container, inactive);
    },
    'disease-picker' : function (container, inactive) {
      this._toggleFieldVisibility(container, inactive);
    },
    'hpo-picker' : function (container, inactive) {
      this._toggleFieldVisibility(container, inactive);
    },
    'gene-picker' : function (container, inactive) {
      this._toggleFieldVisibility(container, inactive);
    },
    'select' : function (container, inactive) {
      this._toggleFieldVisibility(container, inactive);
    },
    'hidden' : function (container, inactive) {
      this._toggleFieldVisibility(container, inactive);
    }
  },

  _setFieldDisabled : {
    'radio' : function (container, disabled) {
      if (disabled === true) {
        container.addClassName('hidden');
      } else {
        container.removeClassName('hidden');
        container.select('input[type=radio]').each(function(item) {
          if (disabled && Object.prototype.toString.call(disabled) === '[object Array]') {
            item.disabled = (disabled.indexOf(item.value) >= 0);
          }
          if (!disabled) {
            item.disabled = false;
          }
        });
      }
    },
    'checkbox' : function (container, disabled) {
      var target = container.down('input[type=checkbox]');
      if (target) {
        target.disabled = disabled;
      }
    },
    'text' : function (container, disabled) {
      var target = container.down('input[type=text]');
      if (target) {
        target.disabled = disabled;
      }
    },
    'textarea' : function (container, inactive) {
      // FIXME: Not implemented
    },
    'date-picker' : function (container, inactive) {
      // FIXME: Not implemented
    },
    'disease-picker' : function (container, inactive) {
      // FIXME: Not implemented
    },
    'hpo-picker' : function (container, inactive) {
      // FIXME: Not implemented
    },
    'gene-picker' : function (container, inactive) {
      // FIXME: Not implemented
    },
    'select' : function (container, inactive) {
      // FIXME: Not implemented
    },
    'hidden' : function (container, inactive) {
      // FIXME: Not implemented
    }
  }
});

export default NodeMenu;
