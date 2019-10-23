import { Timer } from 'pedigree/model/helpers';
import AbstractHoverbox from 'pedigree/view/abstractHoverbox';
import PedigreeEditorParameters from 'pedigree/pedigreeEditorParameters';

/**
 * PersonHoverbox is a class for all the UI elements and graphics surrounding a Person node and
 * its labels. This includes the box that appears around the node when it's hovered by a mouse, as
 * well as the handles used for creating connections and creating new nodes.
 *
 * @class PersonHoverbox
 * @extends AbstractHoverbox
 * @constructor
 * @param {Person} personNode The person for whom this hoverbox is being drawn.
 * @param {Number} centerX The X coordinate for the center of the hoverbox
 * @param {Number} centerY The Y coordinate for the center of the hoverbox
 * @param {Raphael.st} nodeShapes All shapes associated with the person node
 */

var PersonHoverbox = Class.create(AbstractHoverbox, {

  initialize: function($super, personNode, centerX, centerY, nodeShapes) {
    var radius = PedigreeEditorParameters.attributes.personHoverBoxRadius;
    $super(personNode, -radius, -radius, radius * 2, radius * 2, centerX, centerY, nodeShapes);
  },

  /**
     * Creates the handles used in this hoverbox
     *
     * @method generateHandles
     * @return {Raphael.st} A set of handles
     */
  generateHandles: function($super) {
    if (this._currentHandles !== null) {
      return;
    }
    $super();

    //var timer = new Timer();

    var x          = this.getNodeX();
    var y          = this.getNodeY();
    var node       = this.getNode();
    var nodeShapes = node.getGraphics().getGenderGraphics().flatten();

    editor.getPaper().setStart();

    var strokeWidth = editor.getWorkspace().getSizeNormalizedToDefaultZoom(PedigreeEditorParameters.attributes.handleStrokeWidth);

    var partnerGender = 'U';
    if (node.getGender() == 'F') {
      partnerGender = 'M';
    }
    if (node.getGender() == 'M') {
      partnerGender = 'F';
    }

    // static part (2 lines: going above the node + going to the left)
    var splitLocationY = y-PedigreeEditorParameters.attributes.personHandleBreakY-4;
    var path = [['M', x, y],['L', x, splitLocationY], ['L', x-PedigreeEditorParameters.attributes.personSiblingHandleLengthX, splitLocationY]];
    editor.getPaper().path(path).attr({'stroke-width': strokeWidth, stroke: 'gray'}).insertBefore(nodeShapes);

    // sibling handle
    this.generateHandle('sibling', x-PedigreeEditorParameters.attributes.personSiblingHandleLengthX+strokeWidth/3, splitLocationY, x-PedigreeEditorParameters.attributes.personSiblingHandleLengthX+strokeWidth/2, splitLocationY+PedigreeEditorParameters.attributes.personSiblingHandleLengthY,
      'Click to create a sibling or drag to an existing parentless person (valid choices will be highlighted in green)');

    if (editor.getGraph().getParentRelationship(node.getID()) === null) {
      // parent handle
      this.generateHandle('parent', x, splitLocationY, x, y - PedigreeEditorParameters.attributes.personHandleLength,
        'Click to create new nodes for the parents or drag to an existing person or partnership (valid choices will be highlighted in green). Dragging to a person will create a new relationship.');
    }

    if (!node.isFetus()) {

      if (node.getChildlessStatus() === null) {
        // children handle
        //static part (going right below the node)
        var path = [['M', x, y],['L', x, y+PedigreeEditorParameters.attributes.personHandleBreakX]];
        editor.getPaper().path(path).attr({'stroke-width': strokeWidth, stroke: 'gray'}).insertBefore(nodeShapes);
        this.generateHandle('child', x, y+PedigreeEditorParameters.attributes.personHandleBreakX-2, x, y+PedigreeEditorParameters.attributes.personHandleLength,
          'Click to create a new child node or drag to an existing parentless person (valid choices will be highlighted in green)');
      }

      // partner handle
      var vertPosForPartnerHandles = y;
      //static part (going right form the node)
      var path = [['M', x, vertPosForPartnerHandles],['L', x + PedigreeEditorParameters.attributes.personHandleBreakX, vertPosForPartnerHandles]];
      editor.getPaper().path(path).attr({'stroke-width': strokeWidth, stroke: 'gray'}).insertBefore(nodeShapes);
      this.generateHandle('partnerR', x + PedigreeEditorParameters.attributes.personHandleBreakX - 2, vertPosForPartnerHandles, x + PedigreeEditorParameters.attributes.personHandleLength, vertPosForPartnerHandles,
        'Click to create a new partner node or drag to an existing node (valid choices will be highlighted in green)');
    }

    this._currentHandles.push( editor.getPaper().setFinish() );

    //timer.printSinceLast("Generate handles ");
  },

  /**
     * Creates the buttons used in this hoverbox
     *
     * @method generateButtons
     */
  generateButtons: function($super) {
    if (this._currentButtons !== null) {
      return;
    }
    $super();

    this.generateMenuBtn();

    // proband can't be removed
    if (!this.getNode().isProband()) {
      this.generateDeleteBtn();
    }
  },

  /**
     * Creates a node-shaped show-menu button
     *
     * @method generateMenuBtn
     * @return {Raphael.st} The generated button
     */
  generateMenuBtn: function() {
    var me = this;
    var action = function() {
      me.toggleMenu(!me.isMenuToggled());
    };
    var genderShapedButton = this.getNode().getGraphics().getGenderShape().clone();
    genderShapedButton.attr(PedigreeEditorParameters.attributes.nodeShapeMenuOff);
    genderShapedButton.click(action);
    genderShapedButton.hover(function() {
      genderShapedButton.attr(PedigreeEditorParameters.attributes.nodeShapeMenuOn);
    },
    function() {
      genderShapedButton.attr(PedigreeEditorParameters.attributes.nodeShapeMenuOff);
    });
    genderShapedButton.attr('cursor', 'pointer');
    this._currentButtons.push(genderShapedButton);
    this.disable();
    this.getFrontElements().push(genderShapedButton);
    this.enable();
  },

  /**
     * Returns true if the menu for this node is open
     *
     * @method isMenuToggled
     * @return {Boolean}
     */
  isMenuToggled: function() {
    return this._isMenuToggled;
  },

  /**
     * Shows/hides the menu for this node
     *
     * @method toggleMenu
     */
  toggleMenu: function(isMenuToggled) {
    if (this._justClosedMenu) {
      return;
    }
    this._isMenuToggled = isMenuToggled;
    if(isMenuToggled) {
      this.getNode().getGraphics().unmark();
      var optBBox = this.getBoxOnHover().getBBox();
      var x = optBBox.x2;
      var y = optBBox.y;
      var position = editor.getWorkspace().canvasToDiv(x+5, y);
      editor.getNodeMenu().show(this.getNode(), position.x, position.y);
    }
  },

  /**
     * Hides the hoverbox with a fade out animation
     *
     * @method animateHideHoverZone
     */
  animateHideHoverZone: function($super) {
    this._hidden = true;
    if(!this.isMenuToggled()){
      var parentPartnershipNode = editor.getGraph().getParentRelationship(this.getNode().getID());
      if (parentPartnershipNode && editor.getNode(parentPartnershipNode)) {
        editor.getNode(parentPartnershipNode).getGraphics().unmarkPregnancy();
      }
      $super();
    }
  },

  /**
     * Displays the hoverbox with a fade in animation
     *
     * @method animateDrawHoverZone
     */
  animateDrawHoverZone: function($super) {
    this._hidden = false;
    if(!this.isMenuToggled()){
      var parentPartnershipNode = editor.getGraph().getParentRelationship(this.getNode().getID());
      if (parentPartnershipNode && editor.getNode(parentPartnershipNode)) {
        editor.getNode(parentPartnershipNode).getGraphics().markPregnancy();
      }
      $super();
    }
  },

  /**
     * Performs the appropriate action for clicking on the handle of type handleType
     *
     * @method handleAction
     * @param {String} handleType "child", "partner" or "parent"
     * @param {Boolean} isDrag True if this handle is being dragged
     */
  handleAction : function(handleType, isDrag, curHoveredId) {

    if(isDrag && curHoveredId !== null) {

      if(handleType == 'parent') {
        this.removeHandles();
        this.removeButtons();
        var event = { 'personID': this.getNode().getID(), 'parentID': curHoveredId };
        document.fire('pedigree:person:drag:newparent', event);
      } else if(handleType == 'partnerR' || handleType == 'partnerL') {
        this.removeHandles();
        var event = { 'personID': this.getNode().getID(), 'partnerID': curHoveredId };
        document.fire('pedigree:person:drag:newpartner', event);
      } else if(handleType == 'child') {
        var event = { 'personID': curHoveredId, 'parentID': this.getNode().getID() };
        document.fire('pedigree:person:drag:newparent', event);
      } else if(handleType == 'sibling') {
        var event = { 'sibling2ID': curHoveredId, 'sibling1ID': this.getNode().getID() };
        document.fire('pedigree:person:drag:newsibling', event);
      }
    } else if (!isDrag) {
      if(handleType == 'partnerR' || handleType == 'partnerL') {
        this.removeHandles();
        var preferLeft = (this.getNode().getGender() == 'F') || (handleType == 'partnerL');
        var event = { 'personID': this.getNode().getID(), 'preferLeft': preferLeft };
        document.fire('pedigree:person:newpartnerandchild', event);
      } else if(handleType == 'child') {
        var position = editor.getWorkspace().canvasToDiv(this.getNodeX(), (this.getNodeY() + PedigreeEditorParameters.attributes.personHandleLength + 15));
        editor.getNodetypeSelectionBubble().show(this.getNode(), position.x, position.y);
        // if user selects anything the bubble will fire an even on its own
      } else if(handleType == 'sibling') {
        var position = editor.getWorkspace().canvasToDiv(this.getNodeX() - PedigreeEditorParameters.attributes.personSiblingHandleLengthX,
          this.getNodeY() - PedigreeEditorParameters.attributes.personHandleBreakY+PedigreeEditorParameters.attributes.personSiblingHandleLengthY + 15);
        editor.getSiblingSelectionBubble().show(this.getNode(), position.x, position.y);
      } else if(handleType == 'parent') {
        this.removeHandles();
        this.removeButtons();
        var event = { 'personID': this.getNode().getID() };
        document.fire('pedigree:person:newparent', event);
      }
    }
    this.animateHideHoverZone();
  }
});

export default PersonHoverbox;
