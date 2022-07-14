import Helpers from 'pedigree/model/helpers';

/**
 * Base class for various "legend" widgets
 *
 * @class Legend
 * @constructor
 */
const Legend = Class.create({

  /**
   *
   * @param {String} title
   * @param terminology
   */
  initialize: function (title, terminology) {
    this._affectedNodes = {};     // for each object: the list of affected person nodes

    this._objectColors = {};       // for each object: the corresponding object color

    this._cache = {};
    this._terminology = terminology;

    let legendContainer = $('legend-container');
    if (!legendContainer) {
      console.debug("Create legend container");
      legendContainer = new Element('div', {'class': 'legend-container', 'id': 'legend-container'});
      editor.getWorkspace().getWorkArea().insert(legendContainer);
    }

    this._legendBox = new Element('div', {'class' : 'legend-box', id: 'legend-box'});
    this._legendBox.hide();
    legendContainer.insert(this._legendBox);

    const legendTitle = new Element('h2', {'class': 'legend-title'}).update(title);
    this._legendBox.insert(legendTitle);

    this._list = new Element('ul', {'class' : 'disorder-list'});
    this._legendBox.insert(this._list);

    Element.observe(this._legendBox, 'mouseover', function() {
      const menuBox = $$('.menu-box');
      if (menuBox){
        menuBox.invoke('setOpacity', .1);
      }
    });
    Element.observe(this._legendBox, 'mouseout', function() {
      const menuBox = $$('.menu-box');
      if (menuBox){
        menuBox.invoke('setOpacity', 1);
      }
    });
  },

  /**
     * Returns the prefix to be used on elements related to the object
     * (of type tracked by this legend) with the given id.
     *
     * @method _getPrefix
     * @param {String|Number} id ID of the object
     * @return {String} some identifier which should be a valid HTML id value (e.g. no spaces)
     */
  _getPrefix: function(id) {
    // To be overwritten in derived classes
    throw 'prefix not defined';
  },

  /**
   * Returns the disorder object with the given ID. If object is not in cache yet
   * returns a newly created one which may have the disorder name & other attributes not loaded yet
   *
   * @method getDisorder
   * @return {Object}
   */
  getTerm: function (termId) {
    const id = this._terminology.sanitizeID(termId);
    if (!this._cache.hasOwnProperty(id)) {
      this._cache[id] = this._terminology.createTerm(id, null, () => this._updateTermName(id));
    }
    return this._cache[id];
  },

  _updateTermName: function (id) {
    const name = this._legendBox.down('li#' + this._getPrefix(id) + '-' + id + ' .disorder-name');
    name.update(this._cache[id].getName());
  },

  getCurrentTerms: function () {
    const currentTerms = [];
    for (const id in this._affectedNodes) {
      currentTerms.push(this._cache[id]);
    }
    return currentTerms;
  },

  addToCache: function(termId, name) {
    const id = this._terminology.sanitizeID(termId);
    if (!this._cache.hasOwnProperty(id)) {
      this._cache[id] = this._terminology.createTerm(id, name);
    }
  },
  /**
     * Retrieve the color associated with the given object
     *
     * @method getObjectColor
     * @param {String|Number} id ID of the object
     * @return {String} CSS color value for the object, displayed on affected nodes in the pedigree and in the legend
     */
  getObjectColor: function(id) {
    if (!this._objectColors.hasOwnProperty(id)) {
      return '#ff0000';
    }
    return this._objectColors[id];
  },

  /**
     * Returns True if there are nodes reported to have the object with the given id
     *
     * @method _hasAffectedNodes
     * @param {String|Number} id ID of the object
     * @private
     */
  _hasAffectedNodes: function(id) {
    return this._affectedNodes.hasOwnProperty(id);
  },

  /**
     * Registers an occurrence of an object type being tracked by this legend.
     *
     * @method addCase
     * @param {String|Number} id ID of the object
     * @param {String} name The description of the object to be displayed
     * @param {Number} nodeID ID of the Person who has this object associated with it
     */
  addCase: function(id, name, nodeID) {
    if(Object.keys(this._affectedNodes).length === 0) {
      this._legendBox.show();
    }
    if(!this._hasAffectedNodes(id)) {
      this._affectedNodes[id] = [nodeID];
      const listElement = this._generateElement(id, name);
      this._list.insert(listElement);
    } else {
      this._affectedNodes[id].push(nodeID);
    }
    this._updateCaseNumbersForObject(id);
  },

  /**
     * Removes an occurrence of an object, if there are any. Removes the object
     * from the 'Legend' box if this object is not registered in any individual any more.
     *
     * @param {String|Number} id ID of the object
     * @param {Number} nodeID ID of the Person who has/is affected by this object
     */
  removeCase: function(id, nodeID) {
    if (this._hasAffectedNodes(id)) {
      this._affectedNodes[id] = this._affectedNodes[id].without(nodeID);
      if(this._affectedNodes[id].length === 0) {
        delete this._affectedNodes[id];
        delete this._objectColors[id];
        const htmlElement = this._getListElementForObjectWithID(id);
        htmlElement.remove();
        if(Object.keys(this._affectedNodes).length === 0) {
          this._legendBox.hide();
        }
      } else {
        this._updateCaseNumbersForObject(id);
      }
    }
  },

  searchForTerms: function(searchTerm, onSuccess, onError, onComplete){
    this._terminology.searchForTerms(searchTerm, onSuccess, onError, onComplete);
  },

  _getListElementForObjectWithID: function (id) {
    return $(this._getPrefix(id) + '-' + id);
  },

  /**
     * Updates the displayed number of nodes assocated with/affected by the object
     *
     * @method _updateCaseNumbersForObject
     * @param {String|Number} id ID of the object
     * @private
     */
  _updateCaseNumbersForObject : function(id) {
    const label = this._legendBox.down('li#' + this._getPrefix() + '-' + id + ' .disorder-cases');
    if (label) {
      const cases = this._affectedNodes.hasOwnProperty(id) ? this._affectedNodes[id].length : 0;
      label.update(cases + '&nbsp;case' + ((cases - 1) && 's' || ''));
    }
  },

  /**
     * Generate the element that will display information about the given object in the legend
     *
     * @method _generateElement
     * @param {String|Number} id ID of the object
     * @param {String} name The human-readable object name or description
     * @return {HTMLLIElement} List element to be insert in the legend
     */
  _generateElement: function(id, name) {
    const color = this.getObjectColor(id);
    const item = new Element('li', {'class' : 'disorder', 'id' : this._getPrefix() + '-' + id}).update(new Element('span', {'class' : 'disorder-name'}).update(name));
    const bubble = new Element('span', {'class' : 'disorder-color'});
    bubble.style.backgroundColor = color;
    item.insert({'top' : bubble});
    const countLabel = new Element('span', {'class': 'disorder-cases'});
    const countLabelContainer = new Element('span', {'class': 'disorder-cases-container'}).insert('(').insert(countLabel).insert(')');
    item.insert(' ').insert(countLabelContainer);
    const me = this;
    Element.observe(item, 'mouseover', function() {
      //item.setStyle({'text-decoration':'underline', 'cursor' : 'default'});
      item.down('.disorder-name').setStyle({'background': color, 'cursor' : 'default'});
      me._affectedNodes[id] && me._affectedNodes[id].forEach(function(nodeID) {
        const node = editor.getNode(nodeID);
        node && node.getGraphics().highlight();
      });
    });
    Element.observe(item, 'mouseout', function() {
      //item.setStyle({'text-decoration':'none'});
      item.down('.disorder-name').setStyle({'background':'', 'cursor' : 'default'});
      me._affectedNodes[id] && me._affectedNodes[id].forEach(function(nodeID) {
        const node = editor.getNode(nodeID);
        node && node.getGraphics().unHighlight();
      });
    });
    return item;
  },

  desanitizeID: function(id){
    if (this._terminology){
      return this._terminology.desanitizeID(id);
    }
    return id;
  }
});

export default Legend;
