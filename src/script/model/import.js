import { isInt } from 'pedigree/model/helpers';
import BaseGraph from 'pedigree/model/baseGraph';
import GA4GHFHIRConverter from 'pedigree/GA4GHFHIRConverter';
import RelationshipTracker from 'pedigree/model/relationshipTracker';

var PedigreeImport = function () {
};

PedigreeImport.prototype = {
};

/*PedigreeImport.SUPORTED_FORMATS = {
  PED:                    1,      // standard .PED format. Can only import family structure, gender and the affected status
  PHENOTIPS_GRAPH:        2,      // Phenotips pedigree format, whithout positioning information (needs to be laid out automaticaly)
  PHENOTIPS_INTERNAL_OLD: 3       // Phenotips internal format used during development and in test cases (to be replaced)
};

PedigreeImport.autodetectFormat = function(input) {

}*/

PedigreeImport.initFromPhenotipsInternal = function(inputG) {
  // note: serialize() produces the correct input for this function

  var newG = new BaseGraph();

  var nameToId = {};

  var relationshipHasExplicitChHub = {};

  // first pass: add all vertices and assign vertex IDs
  for (var v = 0; v < inputG.length; v++) {

    if (!inputG[v].hasOwnProperty('name') && !inputG[v].hasOwnProperty('id')) {
      throw 'Invalid inpiut: a node without id and without name';
    }

    var type = BaseGraph.TYPE.PERSON;
    if ( inputG[v].hasOwnProperty('relationship') || inputG[v].hasOwnProperty('rel') ) {
      type = BaseGraph.TYPE.RELATIONSHIP;
      // normally users wont specify childhubs explicitly - but save via JSON does
      if (inputG[v].hasOwnProperty('hub') || inputG[v].hasOwnProperty('haschhub')) {
        relationshipHasExplicitChHub[v] = true;
      }
    } else if ( inputG[v].hasOwnProperty('chhub') ) {
      type = BaseGraph.TYPE.CHILDHUB;
    } else if ( inputG[v].hasOwnProperty('virtual') || inputG[v].hasOwnProperty('virt')) {
      type = BaseGraph.TYPE.VIRTUALEDGE;
    }

    var properties = {};
    if (inputG[v].hasOwnProperty('properties') || inputG[v].hasOwnProperty('prop')) {
      properties = inputG[v].hasOwnProperty('properties') ? inputG[v]['properties'] : inputG[v]['prop'];
    }

    if ( type == BaseGraph.TYPE.PERSON ) {
      if (properties.hasOwnProperty('sex') && !properties.hasOwnProperty('gender')) {
        properties['gender'] = properties['sex'];
      }

      if (!properties.hasOwnProperty('gender')) {
        properties['gender'] = 'U';
      }

      if (inputG[v].hasOwnProperty('gender')) {
        var genderString = inputG[v]['gender'].toLowerCase();
        if( genderString == 'female' || genderString == 'f') {
          properties['gender'] = 'F';
        } else if( genderString == 'male' || genderString == 'm') {
          properties['gender'] = 'M';
        }
      }
    }

    var width = inputG[v].hasOwnProperty('width') ?
      inputG[v].width :
      (type == BaseGraph.TYPE.PERSON ? newG.defaultPersonNodeWidth : newG.defaultNonPersonNodeWidth);

    var newID = newG._addVertex( null, type, properties, width );   // "null" since id is not known yet

    if (inputG[v].hasOwnProperty('name')) {  // note: this means using user input (not produced by this.serialize)
      if (nameToId[inputG[v].name]) {
        throw 'Invalid user input: multiple nodes with the same name';
      }
      if (type == BaseGraph.TYPE.PERSON) {
        newG.properties[newID]['fName'] = inputG[v].name;
      }
      nameToId[inputG[v].name] = newID;
    }

    // when entered by user manually allow users to skip childhub nodes (and create them automatically)
    // (but when saving/restoring from a JSON need to save/restore childhub nodes as they
    //  may have some properties assigned by the user which we need to save/restore)
    if ( type == BaseGraph.TYPE.RELATIONSHIP && !relationshipHasExplicitChHub.hasOwnProperty(v) ) {
      var chHubId = newG._addVertex(null, BaseGraph.TYPE.CHILDHUB, null, width );
      nameToId['_chhub_' + newID] = chHubId;
    }
  }

  // second pass (once all vertex IDs are known): process edges
  for (var v = 0; v < inputG.length; v++) {
    var nextV = inputG[v];

    var vID    = nextV.hasOwnProperty('id') ? nextV.id : nameToId[nextV.name];
    var origID = vID;

    var substitutedID = false;

    if (newG.type[vID] == BaseGraph.TYPE.RELATIONSHIP && !relationshipHasExplicitChHub.hasOwnProperty(vID)) {
      // replace edges from rel node by edges from childhub node
      var childhubID = nameToId['_chhub_' + vID];
      vID = childhubID;
      substitutedID = true;
    }

    var maxChildEdgeWeight = 0;

    if (nextV.outedges) {
      for (var outE = 0; outE < nextV.outedges.length; outE++) {
        var target   = nextV.outedges[outE].to;
        var targetID = nameToId[target] ? nameToId[target] : target;  // can specify target either by name or ID

        if (!newG.isValidId(targetID)) {
          throw 'Invalid input: invalid edge target (' + target + ')';
        }

        var weight = 1;
        if (nextV.outedges[outE].hasOwnProperty('weight')) {
          weight = nextV.outedges[outE].weight;
        }
        if ( weight > maxChildEdgeWeight ) {
          maxChildEdgeWeight = weight;
        }

        newG.addEdge( vID, targetID, weight );
      }
    }

    if (substitutedID) {
      newG.addEdge( origID, vID, maxChildEdgeWeight );
    }
  }

  newG.validate();

  return newG;
};

/* ===============================================================================================
 *
 * Creates and returns a BaseGraph from a text string in the PED/LINKAGE format.
 *
 * PED format:
 * (from http://pngu.mgh.harvard.edu/~purcell/plink/data.shtml#ped)
 *   Family ID
 *   Individual ID
 *   Paternal ID
 *   Maternal ID
 *   Sex (1=male; 2=female; other=unknown)
 *   Phenotype
 *
 *   Phenotype, by default, should be coded as:
 *      -9 missing
 *       0 missing
 *       1 unaffected
 *       2 affected
 *
 * =================
 *
 * LINKAGE format:
 * (from http://www.helsinki.fi/~tsjuntun/autogscan/pedigreefile.html)
 *
 *   Column 1:   Pedigree number
 *   Column 2:   Individual ID number
 *   Column 3:   ID of father
 *   Column 4:   ID of mother
 *   Column 5:   First offspring ID
 *   Column 6:   Next paternal sibling ID
 *   Column 7:   Next maternal sibling ID
 *   Column 8:   Sex
 *   Column 9:   Proband status (1=proband, higher numbers indicate doubled individuals formed
 *                               in breaking loops. All other individuals have a 0 in this field.)
 *   Column 10+: Disease and marker phenotypes (as in the original pedigree file)
 * ===============================================================================================
 */
PedigreeImport.initFromPED = function(inputText, acceptOtherPhenotypes, markEvaluated, saveIDAsExternalID, affectedCodeOne, disorderNames) {
  var inputLines = inputText.match(/[^\r\n]+/g);
  if (inputLines.length == 0) {
    throw 'Unable to import: no data';
  }

  // autodetect if data is in pre-makeped or post-makeped format
  var postMakeped = false;
  if (inputLines[0].indexOf('Ped:') > 0 && inputLines[0].indexOf('Per:') > 0) {
    postMakeped = true;
  }

  var familyPrefix = '';

  var newG = new BaseGraph();

  var nameToId = {};

  var phenotypeValues = {};  // set of all posible valuesin the phenotype column

  var extendedPhenotypesFound = false;

  // support both automatic and user-defined assignment of proband
  var nextID = postMakeped ? 1 : 0;

  // first pass: add all vertices and assign vertex IDs
  for (var i = 0; i < inputLines.length; i++) {

    inputLines[i] = inputLines[i].replace(/[^a-zA-Z0-9_.\-\s*]/g, ' ');
    inputLines[i] = inputLines[i].replace(/^\s+|\s+$/g, '');  // trim()

    var parts = inputLines[i].split(/\s+/);
    //console.log("Parts: " + JSON.stringify(parts));

    if (parts.length < 6 || (postMakeped && parts.length < 10)) {
      throw 'Input line has not enough columns: [' + inputLines[i] + ']';
    }

    if (familyPrefix == '') {
      familyPrefix = parts[0];
    } else {
      if (parts[0] != familyPrefix) {
        throw 'Unsupported feature: multiple families detected within the same pedigree';
      }
    }

    var pedID = parts[1];
    if (nameToId.hasOwnProperty(pedID)) {
      throw 'Multiple persons with the same ID [' + pedID + ']';
    }

    var genderValue = postMakeped ? parts[7] : parts[4];
    var gender = 'U';
    if (genderValue == 1) {
      gender = 'M';
    } else if (genderValue == 2) {
      gender = 'F';
    }
    var properties = {'gender': gender};

    if (saveIDAsExternalID) {
      properties['externalID'] = pedID;
    }

    var useID = (postMakeped && parts[8] == 1) ? 0 : nextID++;
    if (i == inputLines.length-1 && newG.v[0] === undefined) {
      // last node and no node with id 0 yet
      useID = 0;
    }

    var pedigreeID = newG._addVertex( useID, BaseGraph.TYPE.PERSON, properties, newG.defaultPersonNodeWidth );

    nameToId[pedID] = pedigreeID;

    var phenotype = postMakeped ? parts[9] : parts[5];
    phenotypeValues[phenotype] = true;
    if (acceptOtherPhenotypes && phenotype != '-9' && phenotype != '0' && phenotype != '1' && phenotype != '2') {
      extendedPhenotypesFound = true;
    }
  }

  // There are two popular schemes for the phenotype column (-9/0/1/2 or -9/0/1).
  // Use the "standard" by default, unless directed to use the other one by the user
  if (affectedCodeOne) {
    if (extendedPhenotypesFound || phenotypeValues.hasOwnProperty('2')) {
      throw 'Phenotypes with codes other than 0 or 1 were found';
    }
    var affectedValues   = { '1':  true };
    var missingValues    = { '-9': true };
    var unaffectedValues = { '0':  true };
  } else {
    var affectedValues   = { '2': true };
    var missingValues    = { '0': true, '-9': true };
    var unaffectedValues = { '1': true };
  }

  if (!disorderNames) {
    disorderNames = {};
    if (extendedPhenotypesFound) {
      for (var phenotype in phenotypeValues) {
        if (phenotypeValues.hasOwnProperty(phenotype)) {
          if (phenotype != '-9' && phenotype != '0' && phenotype != '1') {
            disorderNames[phenotype]  = 'affected (phenotype ' + phenotype + ')';
            affectedValues[phenotype] = true;
          }
        }
      }
    }
  }

  var defaultEdgeWeight = 1;

  var relationshipTracker = new RelationshipTracker(newG, defaultEdgeWeight);

  // second pass (once all vertex IDs are known): process edges
  for (var i = 0; i < inputLines.length; i++) {
    var parts = inputLines[i].split(/\s+/);

    var thisPersonName = parts[1];
    var id = nameToId[thisPersonName];

    var phenotype = postMakeped ? parts[9] : parts[5];
    if (affectedValues.hasOwnProperty(phenotype)) {
      var disorder = disorderNames.hasOwnProperty(phenotype) ? disorderNames[phenotype] : 'affected';
      newG.properties[id]['carrierStatus'] = 'affected';
      newG.properties[id]['disorders']     = [disorder];
      if (markEvaluated) {
        newG.properties[id]['evaluated'] = true;
      }
    } else if (unaffectedValues.hasOwnProperty(phenotype)) {
      newG.properties[id]['carrierStatus'] = '';
      if (markEvaluated) {
        newG.properties[id]['evaluated'] = true;
      }
    } else if (!missingValues.hasOwnProperty(phenotype)) {
      //treat all unsupported values as "unknown/no evaluation"
      //throw "Individual with ID [" + thisPersonName + "] has unsupported phenotype value [" + phenotype + "]";
    }

    // check if parents are given for this individual; if at least one parent is given,
    // check if the corresponding relationship has already been created. If not, create it. If yes,
    // add an edge from childhub to this person

    var fatherID = parts[2];
    var motherID = parts[3];

    if (fatherID == 0 && motherID == 0) {
      continue;
    }

    // .PED supports specifying only mohter of father. Pedigree editor requires both (for now).
    // So create a virtual parent in case one of the parents is missing
    if (fatherID == 0) {
      fatherID = newG._addVertex( null, BaseGraph.TYPE.PERSON, {'gender': 'M', 'comments': 'unknown'}, newG.defaultPersonNodeWidth );
    } else {
      fatherID = nameToId[fatherID];
      if (newG.properties[fatherID].gender == 'F') {
        throw 'Unable to import pedigree: a person declared as female [id: ' + fatherID + '] is also declared as being a father for [id: '+thisPersonName+']';
      }
    }
    if (motherID == 0) {
      motherID = newG._addVertex( null, BaseGraph.TYPE.PERSON, {'gender': 'F', 'comments': 'unknown'}, newG.defaultPersonNodeWidth );
    } else {
      motherID = nameToId[motherID];
      if (newG.properties[motherID].gender == 'M') {
        throw 'Unable to import pedigree: a person declared as male [id: ' + motherID + '] is also declared as being a mother for [id: '+thisPersonName+']';
      }
    }

    // both motherID and fatherID are now given and represent valid existing nodes in the pedigree

    // if there is a relationship between motherID and fatherID the corresponding childhub is returned
    // if there is no relationship, a new one is created together with the chldhub
    var chhubID = relationshipTracker.createOrGetChildhub(motherID, fatherID);

    newG.addEdge( chhubID, id, defaultEdgeWeight );
  }

  PedigreeImport.validateBaseGraph(newG);

  return newG;
};


/* ===============================================================================================
 *
 * Creates and returns a BaseGraph from a text string in the BOADICEA format.
 *
 *  BOADICEA format:
 *  (from https://pluto.srl.cam.ac.uk/bd3/v3/docs/BWA_v3_user_guide.pdf)
 *
 *  line1: BOADICEA import pedigree file format 2.0
 *  line2: column titles
 *  line3+: one patient per line, with values separated by spaces or tabs, as follows:
 *
 *   FamID: Family/pedigree ID, character string (maximum 13 characters)
 *   Name: First name/ID of the family member, character string (maximum 8 characters)
 *   Target: The family member for whom the BOADICEA risk calculation is made, 1 = target for BOADICEA risk calculation, 0 = other family members. There must only be one BOADICEA target individual.
 *   IndivID: Unique ID of the family member, character string (maximum 7 characters)
 *   FathID: Unique ID of their father, 0 = no father, or character string (maximum 7 characters)
 *   MothID: Unique ID of their mother, 0 = unspecified, or character string (maximum 7 characters)
 *   Sex: M or F
 *   Twin: Identical twins, 0 = no identical twin, any non-zero character = twin.
 *   Dead: The current status of the family member, 0 = alive, 1 = dead
 *   Age: Age at last follow up, 0 = unspecified, integer = age at last follow up
 *   Yob: Year of birth, 0 = unspecified, or integer (consistent with Age if the person is alive)
 *   1BrCa: Age at first breast cancer diagnosis, 0 = unaffected, integer = age at diagnosis, AU = unknown age at diagnosis (affected unknown)
 *   2BrCa: Age at contralateral breast cancer diagnosis, 0 = unaffected, integer = age at diagnosis, AU = unknown age at diagnosis (affected unknown)
 *   OvCa: Age at ovarian cancer diagnosis, 0 = unaffected, integer = age at diagnosis, AU = unknown age at diagnosis (affected unknown)
 *   ProCa: Age at prostate cancer diagnosis 0 = unaffected, integer = age at diagnosis, AU = unknown age at diagnosis (affected unknown)
 *   PanCa: Age at pancreatic cancer diagnosis 0 = unaffected, integer = age at diagnosis, AU = unknown age at diagnosis (affected unknown)
 *   Gtest: Genetic test status, 0 = untested, S = mutation search, T = direct gene test
 *   Mutn: 0 = untested, N = no mutation, 1 = BRCA1 positive, 2 = BRCA2 positive, 3 = BRCA1 and BRCA2 positive
 *   Ashkn: 0 = not Ashkenazi, 1 = Ashkenazi
 *   ER: Estrogen receptor status, 0 = unspecified, N = negative, P = positive
 *   PR: Progestrogen receptor status, 0 = unspecified, N = negative, P = positive
 *   HER2: Human epidermal growth factor receptor 2 status, 0 = unspecified, N = negative, P = positive
 *   CK14: Cytokeratin 14 status, 0 = unspecified, N = negative, P = positive
 *   CK56: Cytokeratin 56 status, 0 = unspecified, N = negative, P = positive
 * ===============================================================================================
 */
PedigreeImport.initFromBOADICEA = function(inputText, saveIDAsExternalID) {
  var inputLines = inputText.match(/[^\r\n]+/g);

  if (inputLines.length <= 2) {
    throw 'Unable to import: no data';
  }
  if (inputLines[0].match(/^BOADICEA import pedigree file format 2/i) === null) {
    throw 'Unable to import: unsupported version of the BOADICEA format';
  }
  inputLines.splice(0,2); // remove 2 header lines

  var familyPrefix = '';

  var newG = new BaseGraph();

  var nameToId = {};

  var nextID = 1;

  // first pass: add all vertices and assign vertex IDs
  for (var i = 0; i < inputLines.length; i++) {

    inputLines[i] = inputLines[i].replace(/[^a-zA-Z0-9_.\-\s*]/g, ' ');
    inputLines[i] = inputLines[i].replace(/^\s+|\s+$/g, '');  // trim()

    var parts = inputLines[i].split(/\s+/);
    //console.log("Parts: " + JSON.stringify(parts));

    if (parts.length < 24) {
      throw 'Input line has not enough columns: [' + inputLines[i] + ']';
    }

    if (familyPrefix == '') {
      familyPrefix = parts[0];
    } else {
      if (parts[0] != familyPrefix) {
        throw 'Unsupported feature: multiple families detected within the same pedigree';
      }
    }

    var extID = parts[3];
    if (nameToId.hasOwnProperty(extID)) {
      throw 'Multiple persons with the same ID [' + extID + ']';
    }

    var genderValue = parts[6];
    var gender = 'M';
    if (genderValue == 'F') {
      gender = 'F';
    }
    var name = parts[1];
    if (isInt(name)) {
      name = '';
    }
    var properties = {'gender': gender, 'fName': name};

    if (saveIDAsExternalID) {
      properties['externalID'] = extID;
    }

    var deadStatus = parts[8];
    if (deadStatus == '1') {
      properties['lifeStatus'] = 'deceased';
    }

    var yob = parts[10];
    if (yob != '0') {
      var dob = yob + '-01-01T00:00:00.000Z';
      properties['dob'] = dob;
    }

    // TODO: handle all the columns and proper cancer handling
    //
    // 11: 1BrCa: Age at first breast cancer diagnosis, 0 = unaffected, integer = age at diagnosis, AU = unknown age at diagnosis (affected unknown)
    // 12: 2BrCa: Age at contralateral breast cancer diagnosis, 0 = unaffected, integer = age at diagnosis, AU = unknown age at diagnosis (affected unknown)
    // 13: OvCa:  Age at ovarian cancer diagnosis, 0 = unaffected, integer = age at diagnosis, AU = unknown age at diagnosis (affected unknown)
    // 14: ProCa: Age at prostate cancer diagnosis 0 = unaffected, integer = age at diagnosis, AU = unknown age at diagnosis (affected unknown)
    // 15: PanCa: Age at pancreatic cancer diagnosis 0 = unaffected, integer = age at diagnosis, AU = unknown age at diagnosis (affected unknown)
    var cancers = [ { 'column': 11, 'label': 'Breast cancer',           'disorder': '1BrCa'},
      { 'column': 12, 'label': 'Contralateral breast c.', 'disorder': '2BrCa'},
      { 'column': 13, 'label': 'Ovarian cancer',          'disorder': 'OvCa'},
      { 'column': 14, 'label': 'Prostate cancer',         'disorder': 'ProCa'},
      { 'column': 15, 'label': 'Pancreatic cancer',       'disorder': 'PanCa'} ];

    for (var c = 0; c < cancers.length; c++) {
      var cancer = cancers[c];
      if (parts[cancer['column']].toUpperCase() != 'AU') {
        if (!properties.hasOwnProperty('comments')) {
          properties['comments'] = '';
        } else {
          properties['comments'] += '\n';
        }

        if (parts[cancer['column']] == '0') {
          properties['comments'] += '[-] ' + cancer['label'] + ': unaffected';
        } else {
          properties['comments'] += '[+] ' + cancer['label'] + ': at age ' + parts[cancer['column']];
          if (!properties.hasOwnProperty('disorders')) {
            properties['disorders'] = [];
          }
          properties['disorders'].push(cancer['disorder']);
        }
      }
    }

    var ashkenazi = parts[18];
    if (ashkenazi != '0') {
      properties['ethnicities'] = ['Ashkenazi Jews'];
    }

    var proband = (parts[2] == 1);
    var useID = proband ? 0 : nextID++;
    if (i == inputLines.length-1 && newG.v[0] === undefined) {
      // last node and no proband yet
      useID = 0;
    }

    var pedigreeID = newG._addVertex( useID, BaseGraph.TYPE.PERSON, properties, newG.defaultPersonNodeWidth );

    nameToId[extID] = pedigreeID;
  }

  var defaultEdgeWeight = 1;

  var relationshipTracker = new RelationshipTracker(newG, defaultEdgeWeight);

  // second pass (once all vertex IDs are known): process edges
  for (var i = 0; i < inputLines.length; i++) {
    var parts = inputLines[i].split(/\s+/);

    var extID = parts[3];
    var id    = nameToId[extID];

    // check if parents are given for this individual; if at least one parent is given,
    // check if the corresponding relationship has already been created. If not, create it. If yes,
    // add an edge from childhub to this person

    var fatherID = parts[4];
    var motherID = parts[5];

    if (fatherID == 0 && motherID == 0) {
      continue;
    }

    // .PED supports specifying only mother or father. Pedigree editor requires both (for now).
    // So create a virtual parent in case one of the parents is missing
    if (fatherID == 0) {
      fatherID = newG._addVertex( null, BaseGraph.TYPE.PERSON, {'gender': 'M', 'comments': 'unknown'}, newG.defaultPersonNodeWidth );
    } else {
      fatherID = nameToId[fatherID];
      if (newG.properties[fatherID].gender == 'F') {
        throw 'Unable to import pedigree: a person declared as female [id: ' + fatherID + '] is also declared as being a father for [id: '+extID+']';
      }
    }
    if (motherID == 0) {
      motherID = newG._addVertex( null, BaseGraph.TYPE.PERSON, {'gender': 'F', 'comments': 'unknown'}, newG.defaultPersonNodeWidth );
    } else {
      motherID = nameToId[motherID];
      if (newG.properties[motherID].gender == 'M') {
        throw 'Unable to import pedigree: a person declared as male [id: ' + motherID + '] is also declared as being a mother for [id: '+extID+']';
      }
    }

    // both motherID and fatherID are now given and represent valid existing nodes in the pedigree

    // if there is a relationship between motherID and fatherID the corresponding childhub is returned
    // if there is no relationship, a new one is created together with the childhub
    var chhubID = relationshipTracker.createOrGetChildhub(motherID, fatherID);

    newG.addEdge( chhubID, id, defaultEdgeWeight );
  }

  PedigreeImport.validateBaseGraph(newG);

  return newG;
};

/* ===============================================================================================
 *
 * Validates the generated basegraph and throws one of the following exceptions:
 *
 *  1) "Unsupported pedigree: some components of the imported pedigree are disconnected from each other"
 *  2) "Unable to import pedigree"
 *
 * The method is a wrapper around the internal vlaidate method, which may throw many exceptions
 * which change form version to version
 *
 * ===============================================================================================
 */
PedigreeImport.validateBaseGraph = function(newG) {
  try {
    newG.validate();
  } catch( err) {
    if (err.indexOf('disconnected component')) {
      throw 'Unsupported pedigree: some components of the imported pedigree are disconnected from each other';
    } else {
      throw 'Unable to import pedigree';
    }
  }
};

/* ===============================================================================================
 *
 * GEDCOM file format: http://en.wikipedia.org/wiki/GEDCOM
 *
 * Supported individual (INDI) properties: NAME, SEX, NOTE, ADOP, BIRT, DEAT and DATE
 *  - Non-standard "_GENSTAT" is partially supported (for compatibility with Cyrillic v3)
 *  - Non-standard "_MAIDEN", "_INFO" and "_COMMENT" are supported (for compatibility with Cyrillic v3)
 *  - FAMS is ignored, instead 0-level FAM families are parsed/processed
 *  - only the first instance is used if the same property is given multiple times (e.g. multiple BIRT records)
 *
 * Suported family (FAM) properties: HUSB, WIFE, CHIL
 *
 * Note: reverse-engineered _GENSTAT values: the following symbols, in any position, mean:
 *   Disorder status:
 *    AFFECTED:  "O"
 *    HEARSAY:   "¬"  (hearsay graphic == pre-symptomatic graphic)
 *    UNTESTED:  "E"
 *    "carrier" and "examined" does not seem to be exported to GEDCOM or CSV
 *   Other:
 *    PROBAND:   "C"  (may be more than one)
 *    STILLBORN: "K"
 *    INFERTILE: "M"
 * ===============================================================================================
 */
PedigreeImport.initFromGEDCOM = function(inputText, markEvaluated, saveIDAsExternalID) {
  var inputLines = inputText.match(/[^\r\n]+/g);
  if (inputLines.length == 0) {
    throw 'Unable to import: no data';
  }

  var convertToObject = function(inputLines) {
    /* converts GEDCOM text into an object, where 0-level items are stored as "header", "individuals" and "families"
        * properties, and all items below are arrays of objects, e.g. an array of objects representing each individual.
        *
        * Each next-level keyword is a key in the object, and the associated value is an array of objects, each
        * object representing one encountered instance of the keyword (designed this way as ther emay be more than one
        * keyword with the same nem, e.g. multiple alternative DATEs for an event, or multiple CHILdren in a family)
        *
        * The value of the keyword itself (if any) is stored under the "value" key. In the example below the
        * all "DATA" keywords have no values, while all TEXT and DATE have some values assigned, and only some
        * EVEN keywords have a value.
        *
        * 0 @I1@ INDI
        *  1 EVEN AAA
        *   2 DATE 10 JAN 1800
        *   2 SOUR @S1@
        *    3 DATA
        *     4 TEXT ABC
        *    3 DATA
        *     4 TEXT DEF
        *    3 NOTE DEF
        *    3 ZZZZ 2
        *    3 ZZZZ 3
        *  1 EVEN
        *   2 DATE 1800
        *   2 SOUR @S2@
        *  1 EVEN BBB
        *   2 DATE 1900
        * 0 @I2@ INDI
        *  1 ...
        *
        * is stranslated to:
        *  // level
        *  //  1       2       3        4
        *  [{id: '@I1@'
        *    EVEN: [
        *           {value: 'AAA',
        *            DATE:  [{value: '10 JAN 1800'}],
        *            SOUR:  [{value: '@S1@',
        *                     DATA:  [{TEXT: [{value: 'ABC'}]}, {TEXT: [{value: 'DEF'}]}],
        *                     NOTE:  [{value: 'DEF'}],
        *                     ZZZZ:  [{value: '2'}, {value: '3'}]
        *                    }
        *                   ]
        *           },
        *           {DATE:  [{value: '1800'}],
        *            SOUR:  [{value: '@S2@'}]
        *           },
        *           {value: 'BBB',
        *            DATE:  [{value: '1900'}]
        *           }
        *          ]
        *   },
        *   {id: '@I2@' ...}
        *  ]
        */
    var obj = { 'header': {}, 'individuals': [], 'families': [] };

    var currentObject = [];

    for (var i = 0; i < inputLines.length; i++) {
      var nextLine = inputLines[i].replace(/[^a-zA-Z0-9.\@\/\-\s*]/g, ' ').replace(/^\s+|\s+$/g, ''); // sanitize + trim

      var words = inputLines[i].split(/\s+/);
      var parts = words.splice(0,2);
      parts.push(words.join(' '));

      // now parts[0] = level, parts[1] = record type, parts[2] = value, if any

      var level = parseInt(parts[0]);

      currentObject.splice(level);

      if (level == 0) {
        if (parts[1] == 'HEAD') {
          currentObject[0] = obj.header;
        } else if (parts[1][0] == '@' && parts[2] == 'INDI') {
          obj.individuals.push({});
          currentObject[0] = obj.individuals[obj.individuals.length - 1];
          currentObject[0]['id'] = parts[1];
        } else if (parts[1][0] == '@' && parts[2] == 'FAM') {
          obj.families.push({});
          currentObject[0] = obj.families[obj.families.length - 1];
          currentObject[0]['id'] = parts[1];
        } else {
          currentObject[0] = {};
        }
      } else {
        if (currentObject.length < level - 1) {
          throw 'Unable to import GEDCOM: a multi-level jump detected in line: [' + inputLines[i] + ']';
        }

        if (!currentObject[level-1].hasOwnProperty(parts[1])) {
          currentObject[level-1][parts[1]] = [];
        }  // array of values

        if (currentObject.length < level + 1) {
          currentObject[level] = {};
          currentObject[level - 1][parts[1]].push(currentObject[level]);
        }

        if (parts[2] != '') {
          currentObject[level]['value'] = parts[2];
        }
      }
    }

    return obj;
  };

  var gedcom = convertToObject(inputLines);
  console.log('GEDCOM object: ' + JSON.stringify(gedcom));

  if (gedcom.header.hasOwnProperty('GEDC')) {
    if (gedcom.header.GEDC.hasOwnProperty('VERS')) {
      if (gedcom.header.GEDC.VERS != '5.5' && gedcom.header.GEDC.VERS != '5.5.1') {
        alert('Unsupported GEDCOM version detected: [' + gedcom.header.GEDC.VERS + ']. '+
                     'Import will continue but the correctness is not guaranteed. Supportede versions are 5.5 and 5.5.1');
      }
    }
  }

  if (gedcom.individuals.length == 0) {
    throw 'Unable to create a pedigree from GEDCOM: no individuals are defined in the import data';
  }

  var newG = new BaseGraph();

  var externalIDToID = {};

  // first pass: add all vertices and assign vertex IDs
  for (var i = 0; i < gedcom.individuals.length; i++) {
    var nextPerson =  gedcom.individuals[i];

    var pedigreeID = newG._addVertex( null, BaseGraph.TYPE.PERSON, {}, newG.defaultPersonNodeWidth );

    externalIDToID[nextPerson.id] = pedigreeID;

    var cleanedID = nextPerson.id.replace(/@/g, '');
    var properties = saveIDAsExternalID ? {'externalID': cleanedID} : {};

    properties['gender'] = 'U';     // each person should have some gender set

    var getFirstValue = function(obj) {
      //if (Object.prototype.toString.call(obj) === '[object Array]')
      return obj[0].value;
    };

    var parseDate = function(gedcomDate) {
      gedcomDate = gedcomDate[0].value;

      // treat possible date modifiers
      //  "ABT" - "about"
      //  "EST" - "estimated"
      //  "BEF" - "before"
      //  "AFT" - "after"
      //  "BET ... AND ..." = "between ... and ..."
      // for all of the above the date itself is used as the date; for the "between" the first date is used.
      gedcomDate = gedcomDate.replace(/^(\s*)ABT(\s*)/,'');
      gedcomDate = gedcomDate.replace(/^(\s*)EST(\s*)/,'');
      gedcomDate = gedcomDate.replace(/^(\s*)BEF(\s*)/,'');
      gedcomDate = gedcomDate.replace(/^(\s*)AFT(\s*)/,'');
      var getBetweenDate = /^\s*BET\s+(.+)\s+AND.*/;
      var match = getBetweenDate.exec(gedcomDate);
      if (match != null) {
        gedcomDate = match[1];
      }

      if (gedcomDate == '?') {
        return null;
      }

      var timestamp=Date.parse(gedcomDate);
      if (isNaN(timestamp)==false) {
        return new Date(timestamp);
      }
      return null;
    };

    for (var property in nextPerson) {
      if (nextPerson.hasOwnProperty(property)) {
        if (property == 'SEX') {
          var genderString = getFirstValue(nextPerson[property])[0].toLowerCase(); // use first character only
          if( genderString == 'female' || genderString == 'f') {
            properties['gender'] = 'F';
          } else if( genderString == 'male' || genderString == 'm') {
            properties['gender'] = 'M';
          }
        } else if (property == 'BIRT') {
          if (nextPerson[property][0].hasOwnProperty('DATE')) {
            var date = parseDate(nextPerson[property][0]['DATE']);
            if (date !== null) {
              properties['dob'] = date;
            }
          }
        } else if (property == 'DEAT') {
          if (properties.hasOwnProperty('lifeStatus') && properties['lifeStatus'] == 'stillborn') {
            continue;
          }
          properties['lifeStatus'] = 'deceased';
          if (nextPerson[property][0].hasOwnProperty('DATE')) {
            var date = parseDate(nextPerson[property][0]['DATE']);
            if (date !== null) {
              properties['dod'] = date;
            }
          }
        } else if (property == 'ADOP') {
          properties['isAdopted'] = true;
        } else if (property == '_INFO') {
          if (!properties.hasOwnProperty('comments')) {
            properties['comments'] = '';
          }
          properties['comments'] += '(Info: ' + getFirstValue(nextPerson[property]) + ')\n';
        } else if (property == 'NOTE' || property == '_COMMENT') {
          if (!properties.hasOwnProperty('comments')) {
            properties['comments'] = '';
          }
          properties['comments'] += getFirstValue(nextPerson[property]) + '\n';
          if (nextPerson[property][0].hasOwnProperty('CONT')) {
            var more = nextPerson[property][0]['CONT'];
            for (var cc = 0; cc < more.length; cc++) {
              properties['comments'] += more[cc].value + '\n';
            }
          }
        } else if (property == 'NAME') {
          var nameParts = getFirstValue(nextPerson[property]).split('/');
          var firstName = nameParts[0].replace(/^\s+|\s+$/g, '');
          var lastName  = nameParts.length > 1 ? nameParts[1].replace(/^\s+|\s+$/g, '') : '';
          properties['fName'] = firstName;
          if (lastName != '') {
            properties['lName'] = lastName;
          }
        } else if (property == '_GENSTAT') {
          var props = getFirstValue(nextPerson[property]).split('');
          for (var p = 0; p < props.length; p++) {
            var value = props[p];
            if (value.charCodeAt(0) == 65533 || value.charCodeAt(0) == 172) {
              // one value is obtained via copy-paste, another via file upload
              value = 'HEARSAY';
            }
            switch(value) {
            case 'O':
              properties['carrierStatus'] = 'affected';
              properties['disorders']     = ['affected'];
              if (markEvaluated) {
                properties['evaluated'] = true;
              }
              break;
            case 'HEARSAY':
              properties['carrierStatus'] = 'presymptomatic'; // the closest graphic to cyrillic's "hearsay"
              if (markEvaluated) {
                properties['evaluated'] = true;
              }
              break;
            case 'K':
              properties['lifeStatus'] = 'stillborn';
              break;
            case 'M':
              properties['childlessStatus'] = 'infertile';
              break;
            case 'E':
              if (!properties.hasOwnProperty('comments')) {
                properties['comments'] = '(untested)';
              } else {
                properties['comments'] = '(untested)\n' + properties['comments'];
              }
              break;
            case 'C':
              // TODO: proband
              break;
            }
          }
        }
      }
    }
    if (properties.hasOwnProperty('comments')) {
      // remove trailing newlines and/or empty comments
      properties.comments = properties.comments.replace(/^\s+|\s+$/g, '');
      if (properties.comments == '') {
        delete properties.comments;
      }
    }
    newG.properties[pedigreeID] = properties;
  }

  var defaultEdgeWeight = 1;

  var relationshipTracker = new RelationshipTracker(newG, defaultEdgeWeight);

  var noChildFamilies = [];

  // second pass (once all vertex IDs are known): process families & add edges
  for (var i = 0; i < gedcom.families.length; i++) {
    var nextFamily = gedcom.families[i];

    var motherLink = nextFamily.hasOwnProperty('WIFE') ? getFirstValue(nextFamily['WIFE']) : null;
    var fatherLink = nextFamily.hasOwnProperty('HUSB') ? getFirstValue(nextFamily['HUSB']) : null;

    // create a virtual parent in case one of the parents is missing
    if (fatherLink == null) {
      var fatherID = newG._addVertex( null, BaseGraph.TYPE.PERSON, {'gender': 'M', 'comments': 'unknown'}, newG.defaultPersonNodeWidth );
    } else {
      var fatherID = externalIDToID[fatherLink];
      if (newG.properties[fatherID].gender == 'F') {
        throw 'Unable to import pedigree: a person declared as female is also declared as being a father ('+fatherLink+')';
      }
    }
    if (motherLink == null) {
      var motherID = newG._addVertex( null, BaseGraph.TYPE.PERSON, {'gender': 'F', 'comments': 'unknown'}, newG.defaultPersonNodeWidth );
    } else {
      var motherID = externalIDToID[motherLink];
      if (newG.properties[motherID].gender == 'M') {
        throw 'Unable to import pedigree: a person declared as male is also declared as being a mother ('+motherLink+')';
      }
    }

    // both motherID and fatherID are now given and represent valid existing nodes in the pedigree

    // if there is a relationship between motherID and fatherID the corresponding childhub is returned
    // if there is no relationship, a new one is created together with the chldhub
    var chhubID = relationshipTracker.createOrGetChildhub(motherID, fatherID);

    var children = nextFamily.hasOwnProperty('CHIL') ? nextFamily['CHIL'] : null;

    if (children == null) {
      // create a virtual child
      var childID = newG._addVertex( null, BaseGraph.TYPE.PERSON, {'gender': 'U', 'comments': 'unknown'}, newG.defaultPersonNodeWidth );
      noChildFamilies.push(nextFamily.id);
      externalIDToID[childID] = childID;
      children = [{'value': childID}];
    }

    for (var j = 0; j < children.length; j++) {
      var externalID = children[j].value;

      var childID = externalIDToID.hasOwnProperty(externalID) ? externalIDToID[externalID] : null;

      if (childID == null) {
        throw 'Unable to import pedigree: child link does not point to an existing individual: [' + externalID + ']';
      }

      newG.addEdge( chhubID, childID, defaultEdgeWeight );
    }
  }

  if (noChildFamilies.length > 0) {
    // JSON.stringify(noChildFamilies)
    alert('Some families with no children were found in the imported pedigree: this is not supported at the moment, so a child was added to each childless family');
  }

  PedigreeImport.validateBaseGraph(newG);

  return newG;
};

PedigreeImport.initFromGA4GH = function(inputText){
  return GA4GHFHIRConverter.initFromFHIR(inputText);
};

// ===============================================================================================


// TODO: convert internal properties to match public names and rename this to "supportedProperties"
PedigreeImport.JSONToInternalPropertyMapping = {
  'proband':         'proband',
  'lastname':        'lName',
  'comments':        'comments',
  'twingroup':       'twinGroup',
  'monozygotic':     'monozygotic',
  'adoptedin':       'isAdopted',
  'evaluated':       'evaluated',
  'birthdate':       'dob',
  'deathdate':       'dod',
  'gestationage':    'gestationAge',
  'lifestatus':      'lifeStatus',
  'disorders':       'disorders',
  'hpoterms':        'hpoTerms',
  'candidategenes':  'candidateGenes',
  'ethnicities':     'ethnicities',
  'carrierstatus':   'carrierStatus',
  'externalid':      'externalID',
  'numpersons':      'numPersons',
  'lostcontact':     'lostContact'
};


/*
 * Converts property name from external JSON format to internal - also helps to
 * support aliases for some terms and weed out unsupported terms.
 */
PedigreeImport.convertProperty = function(externalPropertyName, value) {

  if (!PedigreeImport.JSONToInternalPropertyMapping.hasOwnProperty(externalPropertyName)) {
    return null;
  }

  var internalPropertyName = PedigreeImport.JSONToInternalPropertyMapping[externalPropertyName];

  return {'propertyName': internalPropertyName, 'value': value };
};



export default PedigreeImport;
