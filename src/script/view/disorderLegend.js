import Raphael from 'pedigree/raphael';
import Legend from 'pedigree/view/legend';

/**
 * Class responsible for keeping track of disorders and their properties, and for
 * caching disorders data as loaded from the terminology.
 * This information is graphically displayed in a 'Legend' box.
 *
 * @class DisorderLegend
 * @constructor
 */
const DisorderLegend = Class.create(Legend, {

  initialize: function ($super, terminology) {
    $super('Disorders', terminology);

    this._specialDisordersRegexps = [new RegExp('^1BrCa', 'i'),
      new RegExp('^2BrCa', 'i'),
      new RegExp('^OvCa',  'i'),
      new RegExp('^ProCa', 'i'),
      new RegExp('^PanCa', 'i') ];
  },

  _getPrefix: function(id) {
    return 'disorder';
  },

  /**
   * Returns the disorder object with the given ID. If object is not in cache yet
   * returns a newly created one which may have the disorder name & other attributes not loaded yet
   *
   * @method getDisorder
   * @return {Object}
   */
  getDisorder: function (disorderID) {
    return this.getTerm(disorderID);
  },

  /**
     * Generate the element that will display information about the given disorder in the legend
     *
     * @method _generateElement
     * @param {Number} disorderID The id for the disorder, taken from the OMIM database
     * @param {String} name The human-readable disorder name
     * @return {HTMLLIElement} List element to be insert in the legend
     */
  _generateElement: function($super, disorderID, name) {
    if (!this._objectColors.hasOwnProperty(disorderID)) {
      const color = this._generateColor(disorderID);
      this._objectColors[disorderID] = color;
      document.fire('disorder:color', {'id' : disorderID, color: color});
    }

    return $super(disorderID, name);
  },

  /**
     * Generates a CSS color.
     * Has preference for some predefined colors that can be distinguished in gray-scale
     * and are distint from gene colors.
     *
     * @method generateColor
     * @return {String} CSS color
     */
  _generateColor: function(disorderID) {
    if(this._objectColors.hasOwnProperty(disorderID)) {
      return this._objectColors[disorderID];
    }

    // check special disorder prefixes
    for (let i = 0; i < this._specialDisordersRegexps.length; i++) {
      if (disorderID.match(this._specialDisordersRegexps[i]) !== null) {
        for (const disorder in this._objectColors) {
          if (this._objectColors.hasOwnProperty(disorder)) {
            if (disorder.match(this._specialDisordersRegexps[i]) !== null) {
              return this._objectColors[disorder];
            }
          }
        }
        break;
      }
    }

    let usedColors = Object.values(this._objectColors),
      // [red/yellow]           prefColors = ["#FEE090", '#f8ebb7', '#eac080', '#bf6632', '#9a4500', '#a47841', '#c95555', '#ae6c57'];
      // [original yellow/blue] prefColors = ["#FEE090", '#E0F8F8', '#8ebbd6', '#4575B4', '#fca860', '#9a4500', '#81a270'];
      // [green]                prefColors = ['#81a270', '#c4e8c4', '#56a270', '#b3b16f', '#4a775a', '#65caa3'];
      prefColors = ['#E0F8F8', '#92c0db', '#4575B4', '#949ab8', '#FEE090', '#bf6632', '#fca860', '#9a4500', '#d12943', '#00a2bf'];
    usedColors.each( function(color) {
      prefColors = prefColors.without(color);
    });
    if (disorderID === 'affected') {
      if (usedColors.indexOf('#FEE090') > -1 ) {
        return '#dbad71';
      } else {
        return '#FEE090';
      }
    }
    if(prefColors.length > 0) {
      return prefColors[0];
    } else {
      let randomColor = Raphael.getColor();
      while(randomColor === '#ffffff' || usedColors.indexOf(randomColor) !== -1) {
        randomColor = '#'+((1<<24)*Math.random()|0).toString(16);
      }
      return randomColor;
    }
  }
});

export default DisorderLegend;
