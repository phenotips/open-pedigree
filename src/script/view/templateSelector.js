import PedigreeTemplates from 'pedigree/view/templates';

/**
 * The UI Element for browsing and selecting pre-defined Pedigree templates
 *
 * @class TemplateSelector
 * @constructor
 * @param {Boolean} isStartupTemplateSelector Set to True if no pedigree has been loaded yet
 */

var TemplateSelector = Class.create( {

  initialize: function(isStartupTemplateSelector) {
    this._isStartupTemplateSelector = isStartupTemplateSelector;
    this.mainDiv = new Element('div', {'class': 'template-picture-container'});
    this.mainDiv.update('Loading list of templates...');
    var closeShortcut = isStartupTemplateSelector ? [] : ['Esc'];
    this.dialog = new PhenoTips.widgets.ModalPopup(this.mainDiv, {close: {method : this.hide.bind(this), keys : closeShortcut}}, {extraClassName: 'pedigree-template-chooser', title: 'Please select a pedigree template', displayCloseButton: !isStartupTemplateSelector, verticalPosition: 'top'});
    isStartupTemplateSelector && this.dialog.show();

    this.mainDiv.update();

    for (var i = 0; i < PedigreeTemplates.length; ++i) {
      var pictureBox = new Element('div', {'class': 'picture-box'});
      pictureBox.update('Loading...');
      this.mainDiv.insert(pictureBox);
      var template = PedigreeTemplates[i];
      pictureBox.innerHTML = template.image;
      pictureBox.pedigreeData = JSON.stringify(template.data);
      pictureBox.description  = template.description;
      pictureBox.title        = pictureBox.description;

      // TODO: render images with JavaScript instead
      if (window.SVGSVGElement &&
                document.implementation.hasFeature('http://www.w3.org/TR/SVG11/feature#Image', '1.1')) {
        pictureBox.update(template.image);
      } else {
        pictureBox.innerHTML = '<table bgcolor=\'#FFFAFA\'><tr><td><br>&nbsp;' + pictureBox.description + '&nbsp;<br><br></td></tr></table>';
      }
      pictureBox.observe('click', this._onTemplateSelected.bindAsEventListener(this, pictureBox));
    }
  },

  /**
     * Returns True if this template selector is the one displayed on startup
     *
     * @method isStartupTemplateSelector
     * @return {Boolean}
     */
  isStartupTemplateSelector: function() {
    return this._isStartupTemplateSelector;
  },

  /**
     * Loads the template once it has been selected
     *
     * @param event
     * @param pictureBox
     * @private
     */
  _onTemplateSelected: function(event, pictureBox) {
    //console.log("observe onTemplateSelected");
    this.dialog.close();
    editor.getSaveLoadEngine().createGraphFromSerializedData(pictureBox.pedigreeData, false /* add to undo stack */, true /*center around 0*/);
  },

  /**
     * Displays the template selector
     *
     * @method show
     */
  show: function() {
    this.dialog.show();
  },

  /**
     * Removes the the template selector
     *
     * @method hide
     */
  hide: function() {
    this.dialog.closeDialog();
  }
});

export default TemplateSelector;
