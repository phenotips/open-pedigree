/*
 * Helper class which keeps track of relationships already seen in pedigree being imported
 */
import BaseGraph from 'pedigree/model/baseGraph';

var RelationshipTracker = function (newG, defaultEdgeWeight) {
  this.newG = newG;

  this.defaultEdgeWeight = defaultEdgeWeight;

  this.relationships = {};
  this.relChildHubs  = {};
};

RelationshipTracker.prototype = {

  // if there is a relationship between motherID and fatherID the corresponding childhub is returned
  // if there is no relationship, a new one is created together with the chldhub
  createOrGetChildhub: function (motherID, fatherID) {
    // both motherID and fatherID are now given. Check if there is a relationship between the two of them
    if (this.relationships.hasOwnProperty(motherID) && this.relationships[motherID].hasOwnProperty(fatherID)) {
      var relID   = this.relationships[motherID][fatherID];
      var chhubID = this.relChildHubs[relID];
    } else {
      if (this.relationships[motherID] === undefined) {
        this.relationships[motherID] = {};
      }
      if (this.relationships[fatherID] === undefined) {
        this.relationships[fatherID] = {};
      }

      var relID   = this.newG._addVertex( null, BaseGraph.TYPE.RELATIONSHIP, {}, this.newG.defaultNonPersonNodeWidth );
      var chhubID = this.newG._addVertex( null, BaseGraph.TYPE.CHILDHUB,     {}, this.newG.defaultNonPersonNodeWidth );

      this.newG.addEdge( relID,    chhubID, this.defaultEdgeWeight );
      this.newG.addEdge( motherID, relID,   this.defaultEdgeWeight );
      this.newG.addEdge( fatherID, relID,   this.defaultEdgeWeight );

      this.relationships[motherID][fatherID] = relID;
      this.relationships[fatherID][motherID] = relID;
      this.relChildHubs[relID] = chhubID;
    }

    return chhubID;
  }
};

export default RelationshipTracker;
