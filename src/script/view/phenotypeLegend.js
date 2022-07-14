import Legend from 'pedigree/view/legend';

/**
 * Class responsible for keeping track of HPO terms and their properties, and for
 * caching disorders data as loaded from the terminology.
 * This information is graphically displayed in a 'Legend' box
 *
 * @class PhenotypeLegend
 * @constructor
 */
const PhenotypeLegend = Class.create(Legend, {

  initialize: function ($super, terminology) {
    $super('Phenotypes', terminology);
  },

  _getPrefix: function (id) {
    return 'hpo';
  },

  /**
   * Retrieve the color associated with the given object
   *
   * @method getObjectColor
   * @param {String|Number} id ID of the object
   * @return {String} CSS color value for that disorder
   */
  getObjectColor: function (id) {
    return '#CCCCCC';
  }
});

export default PhenotypeLegend;
