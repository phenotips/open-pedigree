import BaseGraph from 'pedigree/model/baseGraph';
import RelationshipTracker from 'pedigree/model/relationshipTracker';



/**
 * Code taken from https://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid
 * @returns UUID
 */
function uuidv4() {
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}

function generateUUID() {
  return 'urn:uuid:' + uuidv4();
}

var GA4GHFHIRConverter = function () {
};

GA4GHFHIRConverter.prototype = {};

/* ===============================================================================================
 *
 * Creates and returns a BaseGraph from a text string in the "FHIR JSON" format.
 *
 * We will support 2 different styles of fhir resource, a composition in the format used to export the
 * pedigree and a List of FamilyMemberHistory resources.
 * ===============================================================================================
 */


GA4GHFHIRConverter.initFromFHIR = function (inputText) {
  let inputResource = null;
  try {
    inputResource = JSON.parse(inputText);
  } catch (err) {
    throw 'Unable to import pedigree: input is not a valid JSON string '
    + err;
  }
  let compositionResource = undefined;
  let containedResources = undefined;

  if (inputResource.resourceType === 'Composition' && inputResource.meta  && inputResource.meta.profile
    && inputResource.meta.profile.includes('http://purl.org/ga4gh/pedigree-fhir-ig/StructureDefinition/Pedigree')) {
    compositionResource = inputResource;
    containedResources = inputResource.contained;
  } else if (inputResource.resourceType === 'Bundle' && inputResource.type === 'document' ) {
    compositionResource = inputResource.entry[0].resource;
    if (compositionResource && compositionResource.resourceType === 'Composition' && compositionResource.meta  && compositionResource.meta.profile
      && compositionResource.meta.profile.includes('http://purl.org/ga4gh/pedigree-fhir-ig/StructureDefinition/Pedigree')){
      containedResources = inputResource.entry.map(entry => entry.resource);
    } else {
      compositionResource = null;
    }
  }

  if (!compositionResource || !containedResources) {
    throw 'Unable to import pedigree: input is not expected JSON format';
  }


  let twinTracker = {'nextTwinGroupId': 1, 'lookup': {}, 'groupIdLookup': {}};
  let containedResourcesLookup = {};
  let patientResources = [];
  let familyHistoryResources = [];
  let conditionResources = [];
  let observationResources = [];

  if (containedResources) {
    let containedArr = containedResources;
    for (let i = 0; i < containedResources.length; i++) {
      if (containedArr[i] && containedArr[i].hasOwnProperty('id')){
        containedResourcesLookup[this.getReference(containedArr[i].id)] = containedArr[i];
        if (containedArr[i].resourceType === 'Patient') {
          patientResources.push(containedArr[i]);
        }
        if (containedArr[i].resourceType === 'FamilyMemberHistory') {
          familyHistoryResources.push(containedArr[i]);
        }
        if (containedArr[i].resourceType === 'Condition') {
          conditionResources.push(containedArr[i]);
        }
        if (containedArr[i].resourceType === 'Observation') {
          observationResources.push(containedArr[i]);
        }
      }
    }
  }
  // let subjectRef = compositionResource.subject;
  // let subjectResource = null;
  // if (subjectRef && subjectRef.reference
  //   && (subjectRef.reference[0] === '#' || subjectRef.reference.startsWith('urn:uuid:'))) {
  //   // we have a contained patient
  //   subjectResource = containedResourcesLookup[subjectRef.reference];
  // }
  let newG = new BaseGraph();

  let nameToID = {};
  let externalIDToID = {};
  let ambiguousReferences = {};
  let hasID = {};

  let nodeData = [];
  let nodeDataLookup = {};
  for (const patientResource of patientResources){
    const node = this.extractDataFromPatient(patientResource, containedResourcesLookup, twinTracker);
    node.nodeId = nodeData.size();
    nodeData.push(node);
    nodeDataLookup[this.getReference(node.properties.id)] = node;
  }

  for (const fmhResource of familyHistoryResources){
    this.extractDataFromFMH(fmhResource, nodeDataLookup, containedResourcesLookup, twinTracker);
  }

  for (const conditionResource of conditionResources){
    this.extractDataFromCondition(conditionResource, nodeDataLookup, containedResourcesLookup, twinTracker);
  }

  for (const observationResource of observationResources){
    this.extractDataFromObservation(observationResource, nodeDataLookup, containedResourcesLookup, twinTracker);
  }




  // first pass: add all vertices and assign vertex IDs
  for (const nextPerson of nodeData){
    // add twin groups
    if (nextPerson.nodeId in twinTracker.lookup){
      nextPerson.properties.twinGroup = twinTracker.lookup[nextPerson.nodeId];
    }

    let pedigreeID = newG._addVertex(null, BaseGraph.TYPE.PERSON, nextPerson.properties,
      newG.defaultPersonNodeWidth);

    if (nextPerson.properties.id) {
      if (externalIDToID.hasOwnProperty(nextPerson.properties.id)) {
        throw 'Unable to import pedigree: multiple persons with the same ID ['
        + nextPerson.properties.id + ']';
      }
      if (nameToID.hasOwnProperty(nextPerson.properties.id)
        && nameToID[nextPerson.properties.id] !== pedigreeID) {
        delete nameToID[nextPerson.properties.id];
        ambiguousReferences[nextPerson.properties.id] = true;
      } else {
        externalIDToID[nextPerson.properties.id] = pedigreeID;
        hasID[nextPerson.properties.id] = true;
      }
    }
    if (nextPerson.properties.fName) {
      if (nameToID.hasOwnProperty(nextPerson.properties.fName)
        && nameToID[nextPerson.properties.fName] !== pedigreeID) {
        // multiple nodes have this first name
        delete nameToID[nextPerson.properties.fName];
        ambiguousReferences[nextPerson.properties.fName] = true;
      } else if (externalIDToID.hasOwnProperty(nextPerson.properties.fName)
        && externalIDToID[nextPerson.properties.fName] !== pedigreeID) {
        // some other node has this name as an ID
        delete externalIDToID[nextPerson.properties.fName];
        ambiguousReferences[nextPerson.properties.fName] = true;
      } else {
        nameToID[nextPerson.properties.fName] = pedigreeID;
      }
    }
    // only use externalID if id is not present
    if (nextPerson.properties.hasOwnProperty('externalId')
      && !hasID.hasOwnProperty(pedigreeID)) {
      externalIDToID[nextPerson.properties.externalId] = pedigreeID;
      hasID[pedigreeID] = true;
    }

  }

  let getPersonID = function (person) {
    if (person.properties.hasOwnProperty('id')) {
      return externalIDToID[person.properties.id];
    }

    if (person.hasOwnProperty('fName')) {
      return nameToID[person.properties.fName];
    }
  };

  let findReferencedPerson = function (reference, refType) {
    if (ambiguousReferences.hasOwnProperty(reference)) {
      throw 'Unable to import pedigree: ambiguous reference to ['
      + reference + ']';
    }

    if (externalIDToID.hasOwnProperty(reference)) {
      return externalIDToID[reference];
    }

    if (nameToID.hasOwnProperty(reference)) {
      return nameToID[reference];
    }

    throw 'Unable to import pedigree: ['
    + reference
    + '] is not a valid '
    + refType
    + ' reference (does not correspond to a name or an ID of another person)';
  };

  let defaultEdgeWeight = 1;

  let relationshipTracker = new RelationshipTracker(newG,
    defaultEdgeWeight);

  // second pass (once all vertex IDs are known): process parents/children & add edges
  for (let i = 0; i < nodeData.length; i++) {
    let nextPerson = nodeData[i];

    let personID = getPersonID(nextPerson);

    let motherLink = nextPerson.hasOwnProperty('mother') ? nodeData[nextPerson['mother']].properties.id
      : null;
    let fatherLink = nextPerson.hasOwnProperty('father') ? nodeData[nextPerson['father']].properties.id
      : null;

    if (motherLink == null && fatherLink == null) {
      continue;
    }

    // create a virtual parent in case one of the parents is missing
    let fatherID = null;
    let motherID = null;
    if (fatherLink == null) {
      fatherID = newG._addVertex(null, BaseGraph.TYPE.PERSON, {
        'gender': 'M',
        'comments': 'unknown'
      }, newG.defaultPersonNodeWidth);
    } else {
      fatherID = findReferencedPerson(fatherLink, 'father');
      if (newG.properties[fatherID].gender === 'F') {
        throw 'Unable to import pedigree: a person declared as female is also declared as being a father ('
        + fatherLink + ')';
      }
    }
    if (motherLink == null) {
      motherID = newG._addVertex(null, BaseGraph.TYPE.PERSON, {
        'gender': 'F',
        'comments': 'unknown'
      }, newG.defaultPersonNodeWidth);
    } else {
      motherID = findReferencedPerson(motherLink, 'mother');
      if (newG.properties[motherID].gender === 'M') {
        throw 'Unable to import pedigree: a person declared as male is also declared as being a mother ('
        + motherLink + ')';
      }
    }

    if (fatherID === personID || motherID === personID) {
      throw 'Unable to import pedigree: a person is declared to be his or hew own parent';
    }

    // both motherID and fatherID are now given and represent valid existing nodes in the pedigree

    // if there is a relationship between motherID and fatherID the corresponding childhub is returned
    // if there is no relationship, a new one is created together with the chldhub
    let chhubID = relationshipTracker.createOrGetChildhub(motherID,
      fatherID);

    newG.addEdge(chhubID, personID, defaultEdgeWeight);
  }

  newG.validate();

  // set any partner relationships
  for (const nextPerson of nodeData){
    if (nextPerson.partners){
      let nextPersonId = undefined;
      for (let i=0; i < nextPerson.partners.length; i++){
        const partner = nextPerson.partners[i];
        if (partner < nextPerson.nodeId){
          continue; // should have already been processed.
        }

        const partnerType = nextPerson.partnerType[i];
        if (!partnerType.consangr && !partnerType.broken){
          // nothing to set
          continue;
        }

        if (nextPersonId === undefined){
          nextPersonId = findReferencedPerson(nextPerson.properties.id, 'partner');
        }
        const partnerId = findReferencedPerson(nodeData[partner].properties.id, 'partner');
        let relNode = newG.getRelationshipNode(nextPersonId, partnerId);
        if (relNode){
          let relProperties = newG.properties[relNode];
          if (partnerType.consangr){
            if (relProperties['consangr'] !== 'Y'){
              relProperties['consangr'] = 'Y';
              // check if we can make it 'A'
              let nextGreatGrandParents = newG.getParentGenerations(nextPersonId, 3);
              let partnerGreatGrandParents = newG.getParentGenerations(partnerId, 3);
              for (let elem of nextGreatGrandParents) {
                if (partnerGreatGrandParents.has(elem)) {
                  // found common
                  relProperties['consangr'] = 'A';
                  break;
                }
              }
            }
          }
          if (partnerType.broken){
            relProperties['broken'] = true;
          }
        }
      }
    }
  }
  // PedigreeImport.validateBaseGraph(newG);
  return newG;

};

GA4GHFHIRConverter.extractDataFromFMH = function (familyHistoryResource,
  nodeDataLookup, containedResourcesLookup, twinTracker) {

  let firstFamilyMember = familyHistoryResource.patient.reference;
  let secondFamilyMember = undefined;
  let rel = undefined;

  if (familyHistoryResource.extension){
    for (const ext of familyHistoryResource.extension){
      if (ext.url === 'http://hl7.org/fhir/StructureDefinition/familymemberhistory-patient-record'){
        secondFamilyMember = ext.valueReference.reference;
        break;
      }
    }
  }
  if (!firstFamilyMember || !secondFamilyMember) {
    return;
  }
  if (familyHistoryResource.relationship && familyHistoryResource.relationship.coding){
    for (const coding of familyHistoryResource.relationship.coding){
      if (coding.system === 'http://purl.org/ga4gh/kin.fhir'){
        rel = coding.code;
        break;
      }
    }
  }
  if (!rel){
    return; // didn't have a relationship
  }

  let firstNodeData = nodeDataLookup[firstFamilyMember];
  let secondNodeData = nodeDataLookup[secondFamilyMember];
  if (!firstNodeData || !secondNodeData) {
    return;
  }

  if (rel === 'KIN:027') {
    // NMTH
    if ('mother' in firstNodeData && !('father' in firstNodeData)){
      // we already think we have a mother, may be a parent
      firstNodeData.father = firstNodeData.mother;
    }
    firstNodeData.mother = secondNodeData.nodeId;
  } else if (rel === 'KIN:028'){
    // NFTH
    if ('father' in firstNodeData && !('mother' in firstNodeData)){
      // we already think we have a father, may be a parent
      firstNodeData.mother = firstNodeData.father;
    }
    firstNodeData.father = secondNodeData.nodeId;
  } else if (rel === 'KIN:003' || rel === 'KIN:022'){
    // NPRN or ADOPTPRN
    if (secondNodeData.gender === 'M' && !('father' in firstNodeData)){
      firstNodeData.father = secondNodeData.nodeId;
    } else if (secondNodeData.gender === 'F' && !('mother' in firstNodeData)){
      firstNodeData.mother = secondNodeData.nodeId;
    } else if (!('father' in firstNodeData)){
      firstNodeData.father = secondNodeData.nodeId;
    } else if (!('mother' in firstNodeData)){
      firstNodeData.mother = secondNodeData.nodeId;
    }
  } else if (rel === 'KIN:026' || rel === 'KIN:030' || rel === 'KIN:048'  || rel === 'KIN:049'){
    // SIGOTHR
    let isConsang = (rel === 'KIN:030' || rel === 'KIN:049');
    let isBroken = (rel === 'KIN:048' || rel === 'KIN:049');
    if ('partners' in firstNodeData){
      firstNodeData.partners.push(secondNodeData.nodeId);
      firstNodeData.partnerType.push({consangr: isConsang, broken: isBroken});
    } else {
      firstNodeData.partners = [secondNodeData.nodeId];
      firstNodeData.partnerType = [{consangr: isConsang, broken: isBroken}];
    }
    if ('partners' in secondNodeData){
      secondNodeData.partners.push(firstNodeData.nodeId);
      secondNodeData.partnerType.push({consangr: isConsang, broken: isBroken});
    } else {
      secondNodeData.partners = [firstNodeData.nodeId];
      secondNodeData.partnerType = [{consangr: isConsang, broken: isBroken}];
    }
  } else if (rel === 'KIN:009' || rel === 'KIN:010' || rel === 'KIN:011'){
    // TWIN or Monozygotic twin or Polyzygotic twin
    firstNodeData.properties.monozygotic = (rel === 'KIN:010');
    secondNodeData.properties.monozygotic = (rel === 'KIN:010');
    let firstNodeTwinGroup = twinTracker.lookup[firstNodeData.nodeId];
    let secondNodeTwinGroup = twinTracker.lookup[secondNodeData.nodeId];

    if (!firstNodeTwinGroup && !secondNodeTwinGroup){
      // new twin group
      twinTracker.lookup[firstNodeData.nodeId] = twinTracker.nextTwinGroupId;
      twinTracker.lookup[secondNodeData.nodeId] = twinTracker.nextTwinGroupId;
      twinTracker.groupIdLookup[twinTracker.nextTwinGroupId] = [firstNodeData.nodeId, secondNodeData.nodeId];
      twinTracker.nextTwinGroupId = twinTracker.nextTwinGroupId + 1;
    } else if (!firstNodeTwinGroup){
      // secondNode is already in a twin group
      twinTracker.lookup[firstNodeData.nodeId] = secondNodeTwinGroup;
      twinTracker.groupIdLookup[secondNodeTwinGroup].push(firstNodeData.nodeId);
    } else if (!secondNodeTwinGroup){
      // firstNode is already in a twin group
      twinTracker.lookup[secondNodeData.nodeId] = firstNodeTwinGroup;
      twinTracker.groupIdLookup[firstNodeTwinGroup].push(secondNodeData.nodeId);
    } else if (firstNodeTwinGroup !== secondNodeTwinGroup){
      // they seem to exist to different twin groups, need to merge them
      for (const n of twinTracker.groupIdLookup[secondNodeTwinGroup]){
        twinTracker.lookup[n] = firstNodeTwinGroup;
        twinTracker.groupIdLookup[firstNodeTwinGroup].push(n);
      }
      delete twinTracker.groupIdLookup[secondNodeTwinGroup];
    }
  }

};

GA4GHFHIRConverter.extractDataFromCondition = function (conditionResource, nodeDataLookup, containedResourcesLookup, twinTracker) {
  if (!conditionResource.subject || !(conditionResource.subject.reference in nodeDataLookup) || !conditionResource.code){
    // condition doesn't link to a subject in our list or has no code
    return;
  }

  let familyMember = conditionResource.subject.reference;

  let fhirTerminologyHelper = editor.getFhirTerminologyHelper();

  if (!(familyMember in nodeDataLookup)){
    console.log('Failed to find node for ' + familyMember);
  }
  let nodeData = nodeDataLookup[familyMember];

  if (conditionResource.code){
    let conditionToAdd = fhirTerminologyHelper.getDisorderFromCodeableConcept(conditionResource.code, false);

    if (conditionToAdd){
      if ('disorders' in nodeData.properties){
        nodeData.properties.disorders.push(conditionToAdd);
      } else {
        nodeData.properties.disorders = [conditionToAdd];
      }
    } else {
      console.log('No disorder found in ', conditionResource.code);
    }
  }
};

GA4GHFHIRConverter.extractDataFromObservation = function (observationResource, nodeDataLookup, containedResourcesLookup, twinTracker) {

  if (!observationResource.subject || !(observationResource.subject.reference in nodeDataLookup)){
    // observation doesn't link to a subject in our list or has no code
    return;
  }

  let familyMember = observationResource.subject.reference;

  let nodeData = nodeDataLookup[familyMember];

  let fhirTerminologyHelper = editor.getFhirTerminologyHelper();
  
  let foundCode = false;
  
  if (observationResource.valueCodeableConcept) {
    for (const coding of observationResource.valueCodeableConcept.coding) {
      if (coding.system === 'http://snomed.info/sct' && coding.code === '87955000') {
        nodeData.properties['carrierStatus'] = 'carrier';
        foundCode = true;
        break;
      } else if (coding.system === 'http://snomed.info/sct' && coding.code === '24800002') {
        nodeData.properties['carrierStatus'] = 'presymptomatic';
        foundCode = true;
        break;
      }
    }
    if (!foundCode) {
      let phenotype = fhirTerminologyHelper.getPhenotypeFromCodeableConcept(observationResource.valueCodeableConcept, true);
      if (phenotype) {
        foundCode = true;
        if ('hpoTerms' in nodeData.properties) {
          nodeData.properties.hpoTerms.push(phenotype);
        } else {
          nodeData.properties.hpoTerms = [phenotype];
        }
      }
    }
    if (!foundCode) {
      let gene = fhirTerminologyHelper.getGeneFromCodeableConcept(observationResource.valueCodeableConcept, true);
      if (gene) {
        foundCode = true;
        if ('candidateGenes' in nodeData.properties){
          nodeData.properties.candidateGenes.push(gene);
        } else {
          nodeData.properties.candidateGenes = [gene];
        }
      }
    }
  }
  if (!foundCode){
    if (observationResource.code && observationResource.code.coding) {
      for (const coding of observationResource.code.coding) {
        if (coding.system === 'http://snomed.info/sct' && coding.code === '8619003') {
          nodeData.properties['childlessStatus'] = 'infertile';
          foundCode = true;
          break;
        }
        if (coding.system === 'http://snomed.info/sct' && coding.code === '224118004'
          && observationResource.valueInteger === 0) {
          nodeData.properties['childlessStatus'] = 'childless';
          foundCode = true;
          break;
        }
        if (coding.system === 'http://loinc.org' && coding.code === '48767-8'
          && observationResource.valueString) {
          nodeData.properties['comments'] = observationResource.valueString;
          foundCode = true;
          break;
        }
        if (coding.system === 'http://snomed.info/sct' && coding.code === '441879005'
          && 'Lost contact with proband' === observationResource.valueString) {
          nodeData.properties['lostContact'] = true;
          foundCode = true;
          break;
        }
        if (coding.system === 'http://loinc.org' && coding.code === '96172-2'
          && observationResource.valueBoolean) {
          nodeData.properties['evaluated'] = true;
          foundCode = true;
          break;
        }
      }
    }
  }
  if (!foundCode){
    if (observationResource.valueString){
      const phenotypePrefix = 'phenotype: ';
      const genePrefix = 'gene: ';
      if (observationResource.valueString.startsWith(phenotypePrefix)){
        foundCode = true;
        if ('hpoTerms' in nodeData.properties){
          nodeData.properties.hpoTerms.push(observationResource.valueString.substring(phenotypePrefix.length));
        } else {
          nodeData.properties.hpoTerms = [observationResource.valueString.substring(phenotypePrefix.length)];
        }
      } else if (observationResource.valueString.startsWith(genePrefix)){
        foundCode = true;
        if ('candidateGenes' in nodeData.properties){
          nodeData.properties.candidateGenes.push(observationResource.valueString.substring(genePrefix.length));
        } else {
          nodeData.properties.candidateGenes = [observationResource.valueString.substring(genePrefix.length)];
        }
      } else if (observationResource.id){
        if (observationResource.id.includes('_clinical_')){
          foundCode = true;
          if ('hpoTerms' in nodeData.properties){
            nodeData.properties.hpoTerms.push(observationResource.valueString);
          } else {
            nodeData.properties.hpoTerms = [observationResource.valueString];
          }
        } else if (observationResource.id.includes('_gene_')){
          foundCode = true;
          if ('candidateGenes' in nodeData.properties){
            nodeData.properties.candidateGenes.push(observationResource.valueString);
          } else {
            nodeData.properties.candidateGenes = [observationResource.valueString];
          }
        }
      }
    }
  }
};



GA4GHFHIRConverter.extractDataFromPatient = function (patientResource,
  containedResourcesLookup, twinTracker) {
  let properties = {};
  let result = {
    'properties': properties
  };

  properties.id = patientResource.id;
  properties.gender = 'U';
  if (patientResource.gender === 'male') {
    properties.gender = 'M';
  } else if (patientResource.gender === 'female') {
    properties.gender = 'F';
  }

  const dateTimeSplitter = /([0-9]([0-9]([0-9][1-9]|[1-9]0)|[1-9]00)|[1-9]000)(-(0[1-9]|1[0-2])(-(0[1-9]|[1-2][0-9]|3[0-1])(T([01][0-9]|2[0-3]):[0-5][0-9]:([0-5][0-9]|60)(\.[0-9]+)?(Z|(\+|-)((0[0-9]|1[0-3]):[0-5][0-9]|14:00)))?)?)?/;
  const nameUseOrder = ['anonymous', 'temp', 'expired_nickname', 'expired_', 'expired_usual', 'expired_official', 'maiden', 'old', 'nickname', '', 'usual', 'official'];
  let maxFNameUse = -2;
  let maxLNameUse = -2;
  let maxTextUse = -2;
  let nameText = '';
  if (patientResource.name) {
    for (const humanName of patientResource.name) {
      let use = humanName.use ? humanName.use : '';
      if (humanName.period && humanName.period.end) {
        const now = Date.now();
        const endDt = Date.parse(humanName.period.end);
        if (endDt < now) {
          use = 'expired_' + use;
        }
      }
      const nameUse = nameUseOrder.indexOf(use);
      if (humanName.family) {
        if (nameUse > maxLNameUse) {
          properties.lName = humanName.family;
          maxLNameUse = nameUse;
        }
      }
      if (humanName.given && humanName.given.size() > 0) {
        if (nameUse > maxFNameUse) {
          properties.fName = humanName.given.join(' ');
          maxFNameUse = nameUse;
        }
      }
      if (humanName.text) {
        if (nameUse > maxTextUse) {
          nameText = humanName.text;
          maxTextUse = nameUse;
        }
      }
    }
    if ((maxFNameUse === -2 || maxLNameUse === -2) && maxTextUse > -2) {
      // we are missing part of the name, see if we can get it form the text
      // everything but the last word is the first name
      // a trailing '(name)' will be taken as last name at birth
      let nameSplitter = /^(.*?)( ([^ (]*)) ?(\(([^)]*)\))?$/;
      let nameSplit = nameSplitter.exec(nameText);
      if (nameSplit == null) {
        if (maxLNameUse === -2 && maxFNameUse === -2) {
          properties.fName = nameSplit[1];
        }
      } else {
        if (maxFNameUse === -2) {
          properties.fName = nameSplit[1];
        }
        if (maxLNameUse === -2) {
          properties.lName = nameSplit[3];
        }
      }
    }
  }

  let dateSplitter = /([0-9]([0-9]([0-9][1-9]|[1-9]0)|[1-9]00)|[1-9]000)(-(0[1-9]|1[0-2]|[1-9])(-(0[1-9]|[1-2][0-9]|3[0-1]|[1-9]))?)?/;
  if (patientResource.birthDate) {
    let bornDateSplit = dateSplitter.exec(patientResource.birthDate);
    if (bornDateSplit == null) {
      // failed to parse the data
    } else {
      let year = bornDateSplit[1];
      let month = (bornDateSplit[5]) ? bornDateSplit[5] : '01';
      let day = (bornDateSplit[7]) ? bornDateSplit[7] : '01';
      // properties.dob = day + "/" + month + "/" + year;
      properties.dob = month + '/' + day + '/' + year;
    }
  }

  if (patientResource.deceasedDateTime) {
    let deceasedDateSplit = dateTimeSplitter.exec(patientResource.deceasedDateTime);
    if (deceasedDateSplit == null) {
      // failed to parse the data
    } else {
      let year = deceasedDateSplit[1];
      let month = (deceasedDateSplit[5]) ? deceasedDateSplit[5] : '01';
      let day = (deceasedDateSplit[7]) ? deceasedDateSplit[7] : '01';
      // properties.dod = day + "/" + month + "/" + year;
      properties.dod = month + '/' + day + '/' + year;
    }
  }
  if (patientResource.deceasedBoolean) {
    properties.lifeStatus = 'deceased';
  }

  let checkUnbornExtension = true;
  if (patientResource.deceasedString) {
    let deceasedSplitter = /(stillborn|miscarriage|aborted|unborn)( ([1-9][0-9]?) weeks)?/;
    let deceasedSplit = deceasedSplitter.exec(patientResource.deceasedString);
    if (deceasedSplit == null) {
      // not something we understand
      properties.lifeStatus = 'deceased';
    } else {
      checkUnbornExtension = false;
      properties.lifeStatus = deceasedSplit[1];
      if (deceasedSplit[3]) {
        properties.gestationAge = deceasedSplit[3];
      }
    }
  }

  if (checkUnbornExtension && patientResource.extension) {
    for (const ext of patientResource.extension) {
      if (ext.url === 'http://purl.org/ga4gh/pedigree-fhir-ig/StructureDefinition/patient-unborn') {
        if (ext.valueBoolean) {
          properties.lifeStatus = 'unborn';
        }
        break;
      }
    }
  }

  return result;
};
// ===============================================================================================
/* ===============================================================================================
 *
 * Creates and returns a FHIR Composition representing the graph.
 *
 * ===============================================================================================
 */

GA4GHFHIRConverter.exportAsFHIR = function (pedigree, privacySetting, knownFhirPatienReference, pedigreeImage) {
  // let exportObj = [];
  let today = new Date();
  let tz = today.getTimezoneOffset();
  let tzHours = tz / 60;
  let tzMins = Math.abs(tz - (tzHours * 60));
  let date = today.getFullYear() + '-' + ((today.getMonth() < 9) ? '0' : '') + (today.getMonth() + 1) + '-'
    + ((today.getDate() < 10) ? '0' : '') + today.getDate();
  let time = ((today.getHours() < 10) ? '0' : '') + today.getHours() + ':' + ((today.getMinutes() < 10) ? '0' : '') + today.getMinutes() + ':'
    + ((today.getSeconds() < 10) ? '0' : '') + today.getSeconds();
  let timezone = ((tzHours >= 0) ? '+' : '') + tzHours + ':'
    + ((tzMins < 10) ? '0' : '') + tzMins;
  let dateTime = date + 'T' + time + timezone;

  let pedigreeIndividuals = {}; // will contain map of id/patient resource
  let pedigreeRelationship = []; // all the constructed relationships
  let conditions = {}; // constructed conditions keyed by patient
  let observations = {}; // constructed observations keyed by patient
  let nodeIndexToRef = {}; // maps node index to ref
  let containedResources = [];

  let probandRef = this.processTreeNode(0, pedigree, privacySetting, knownFhirPatienReference, pedigreeIndividuals,
    pedigreeRelationship, conditions, observations, nodeIndexToRef);

  // add any missing nodes, the recursion only goes up the tree
  for (let i = 1; i <= pedigree.GG.getMaxRealVertexId(); i++) {
    if (!pedigree.GG.isPerson(i)) {
      continue;
    }
    this.processTreeNode(i, pedigree, privacySetting, knownFhirPatienReference, pedigreeIndividuals,
      pedigreeRelationship, conditions, observations, nodeIndexToRef);
  }

  let probandReference = {
    'type': 'Patient',
    'reference': this.patRefAsRef(probandRef)
  };

  let probrandSection = {
    'title': 'Proband',
    'code': {
      'coding': [
        {
          'system': 'http://purl.org/ga4gh/pedigree-fhir-ig/CodeSystem/SectionType',
          'code': 'proband'
        }
      ]
    },
    'entry': [
      probandReference
    ]
  };

  let reasonSection = {
    'title': 'Reason',
    'code': {
      'coding': [
        {
          'system': 'http://purl.org/ga4gh/pedigree-fhir-ig/CodeSystem/SectionType',
          'code': 'reason'
        }
      ]
    },
    'entry': []
  };
  for (let probandCond of conditions[probandRef]) {
    reasonSection.entry.push({
      'type': 'Condition',
      'reference': this.getReference(probandCond.id)
    });
  }

  let individualsSection = {
    'title': 'Individuals',
    'code': {
      'coding': [
        {
          'system': 'http://purl.org/ga4gh/pedigree-fhir-ig/CodeSystem/SectionType',
          'code': 'individuals'
        }
      ]
    },
    'entry': []
  };

  let author = {
    'resourceType': 'Organization',
    'id': generateUUID(),
    'name': 'open-pedigree unknown author'
  };

  let authorRef = {
    'type': 'Organization',
    'reference': this.getReference(author.id)
  };
  containedResources.push(author);

  for (let pi in pedigreeIndividuals) {
    containedResources.push(pedigreeIndividuals[pi]);
    individualsSection.entry.push({
      'type': 'Patient',
      'reference': this.patRefAsRef(nodeIndexToRef[pi])
    });
  }

  let relationshipSection = {
    'title': 'Relationships',
    'code': {
      'coding': [
        {
          'system': 'http://purl.org/ga4gh/pedigree-fhir-ig/CodeSystem/SectionType',
          'code': 'relationships'
        }
      ]
    },
    'entry': []
  };
  for (let pr of pedigreeRelationship) {
    containedResources.push(pr);
    relationshipSection.entry.push({
      'type': 'FamilyMemberHistory',
      'reference': this.getReference(pr.id)
    });
  }

  let otherSection = {
    'title': 'Other',
    'code': {
      'coding': [
        {
          'system': 'http://purl.org/ga4gh/pedigree-fhir-ig/CodeSystem/SectionType',
          'code': 'other'
        }
      ]
    },
    'entry': []
  };

  for (let key in conditions) {
    for (let con of conditions[key]) {
      containedResources.push(con);
      otherSection.entry.push({
        'type': 'Condition',
        'reference': this.getReference(con.id)
      });
    }
  }
  for (let key in observations) {
    for (let ob of observations[key]) {
      containedResources.push(ob);
      otherSection.entry.push({
        'type': 'Observation',
        'reference': this.getReference(ob.id)
      });
    }
  }
  let composition = {
    'resourceType': 'Composition',
    'id': generateUUID(),
    'meta': {
      'profile': [
        'http://purl.org/ga4gh/pedigree-fhir-ig/StructureDefinition/Pedigree'
      ]
    },
    'status': 'final',
    'type': {
      'coding': [
        {
          'system': 'http://snomed.info/sct',
          'code': '422432008'
        }
      ]
    },
    'subject': probandReference,
    'date': dateTime,
    'author': authorRef,
    'title': 'Pedigree',
    'section': [
      probrandSection,
      reasonSection,
      individualsSection,
      relationshipSection,
      otherSection]
  };


  if (pedigreeImage) {

    let pedigreeImageDocumentReference = {
      'id': generateUUID(),
      'resourceType': 'DocumentReference',
      'status': 'current',
      'docStatus': 'preliminary',
      'subject': probandReference,
      'description': 'Pedigree Diagram of Family in SVG format',
      'content': {
        'attachment': {
          'contentType': 'image/svg+xml',
          'data': btoa(unescape(encodeURIComponent(pedigreeImage)))
        }
      }
    };
    composition.section.push({
      'title': 'Pedigree Diagram',
      'code': {
        'coding': [
          {
            'system': 'http://purl.org/ga4gh/pedigree-fhir-ig/CodeSystem/SectionType',
            'code': 'pedigreeImage'
          }
        ]
      },
      'entry': [{
        'type': 'DocumentReference',
        'reference': this.getReference(pedigreeImageDocumentReference.id)
      }]
    });
    containedResources.push(pedigreeImageDocumentReference);
  }

  let bundleEntries = containedResources.map(resource => ({'fullUrl': resource.id, 'resource': resource}) );
  let bundleLinks = containedResources.map(resource => ({'relation': 'item', 'url': resource.id}) );

  let bundle = {
    'resourceType': 'Bundle',
    'identifier': {
      'system': 'http://purl.org/ga4gh/pedigree-fhir-ig',
      'value': generateUUID()
    },
    'type': 'document',
    'timestamp': dateTime,
    'entry': [{'link': bundleLinks, 'fullUrl': composition.id, 'resource': composition}, ...bundleEntries]
  };


  return JSON.stringify(bundle, null, 2);
};


GA4GHFHIRConverter.familyHistoryLookup = {
  'notFound': { 'system': 'http://purl.org/ga4gh/kin.fhir', 'code': 'KIN:001', 'display': 'isRelative' },
  'KIN:001': { 'system': 'http://purl.org/ga4gh/kin.fhir', 'code': 'KIN:001', 'display': 'isRelative' },
  'KIN:002': { 'system': 'http://purl.org/ga4gh/kin.fhir', 'code': 'KIN:002', 'display': 'isBiologicalRelative' },
  'KIN:003': { 'system': 'http://purl.org/ga4gh/kin.fhir', 'code': 'KIN:003', 'display': 'isBiologicalParent' },
  'KIN:004': { 'system': 'http://purl.org/ga4gh/kin.fhir', 'code': 'KIN:004', 'display': 'isSpermDonor' },
  'KIN:005': { 'system': 'http://purl.org/ga4gh/kin.fhir', 'code': 'KIN:005', 'display': 'isGestationalCarrier' },
  'KIN:006': { 'system': 'http://purl.org/ga4gh/kin.fhir', 'code': 'KIN:006', 'display': 'isSurrogateOvumDonor' },
  'KIN:007': { 'system': 'http://purl.org/ga4gh/kin.fhir', 'code': 'KIN:007', 'display': 'isBiologicalSibling' },
  'KIN:008': { 'system': 'http://purl.org/ga4gh/kin.fhir', 'code': 'KIN:008', 'display': 'isFullsibling' },
  'KIN:009': { 'system': 'http://purl.org/ga4gh/kin.fhir', 'code': 'KIN:009', 'display': 'isTwin' },
  'KIN:010': { 'system': 'http://purl.org/ga4gh/kin.fhir', 'code': 'KIN:010', 'display': 'isMonozygoticTwin' },
  'KIN:011': { 'system': 'http://purl.org/ga4gh/kin.fhir', 'code': 'KIN:011', 'display': 'isPolyzygoticTwin' },
  'KIN:012': { 'system': 'http://purl.org/ga4gh/kin.fhir', 'code': 'KIN:012', 'display': 'isHalfSibling' },
  'KIN:013': { 'system': 'http://purl.org/ga4gh/kin.fhir', 'code': 'KIN:013', 'display': 'isParentalSibling' },
  'KIN:014': { 'system': 'http://purl.org/ga4gh/kin.fhir', 'code': 'KIN:014', 'display': 'isCousin' },
  'KIN:015': { 'system': 'http://purl.org/ga4gh/kin.fhir', 'code': 'KIN:015', 'display': 'isMaternalCousin' },
  'KIN:016': { 'system': 'http://purl.org/ga4gh/kin.fhir', 'code': 'KIN:016', 'display': 'isPaternalCousin' },
  'KIN:017': { 'system': 'http://purl.org/ga4gh/kin.fhir', 'code': 'KIN:017', 'display': 'isGrandparent' },
  'KIN:018': { 'system': 'http://purl.org/ga4gh/kin.fhir', 'code': 'KIN:018', 'display': 'isGreatGrandparent' },
  'KIN:019': { 'system': 'http://purl.org/ga4gh/kin.fhir', 'code': 'KIN:019', 'display': 'isSocialLegalRelative' },
  'KIN:020': { 'system': 'http://purl.org/ga4gh/kin.fhir', 'code': 'KIN:020', 'display': 'isParentFigure' },
  'KIN:021': { 'system': 'http://purl.org/ga4gh/kin.fhir', 'code': 'KIN:021', 'display': 'isFosterParent' },
  'KIN:022': { 'system': 'http://purl.org/ga4gh/kin.fhir', 'code': 'KIN:022', 'display': 'isAdoptiveParent' },
  'KIN:023': { 'system': 'http://purl.org/ga4gh/kin.fhir', 'code': 'KIN:023', 'display': 'isStepParent' },
  'KIN:024': { 'system': 'http://purl.org/ga4gh/kin.fhir', 'code': 'KIN:024', 'display': 'isSiblingFigure' },
  'KIN:025': { 'system': 'http://purl.org/ga4gh/kin.fhir', 'code': 'KIN:025', 'display': 'isStepSibling' },
  'KIN:026': { 'system': 'http://purl.org/ga4gh/kin.fhir', 'code': 'KIN:026', 'display': 'isPartner' },
  'KIN:027': { 'system': 'http://purl.org/ga4gh/kin.fhir', 'code': 'KIN:027', 'display': 'isBiologicalMother' },
  'KIN:028': { 'system': 'http://purl.org/ga4gh/kin.fhir', 'code': 'KIN:028', 'display': 'isBiologicalFather' },
  'KIN:029': { 'system': 'http://purl.org/ga4gh/kin.fhir', 'code': 'KIN:029', 'display': 'isMitochondrialDonor' },
  'KIN:030': { 'system': 'http://purl.org/ga4gh/kin.fhir', 'code': 'KIN:030', 'display': 'isConsanguineousPartner' },
  'KIN:031': { 'system': 'http://purl.org/ga4gh/kin.fhir', 'code': 'KIN:031', 'display': 'hasSex' },
  'KIN:032': { 'system': 'http://purl.org/ga4gh/kin.fhir', 'code': 'KIN:032', 'display': 'isBiologicalChild' },
  'KIN:033': { 'system': 'http://purl.org/ga4gh/kin.fhir', 'code': 'KIN:033', 'display': 'hasBiologicalChild' },
  'KIN:034': { 'system': 'http://purl.org/ga4gh/kin.fhir', 'code': 'KIN:034', 'display': 'hasBiologicalParent' },
  'KIN:035': { 'system': 'http://purl.org/ga4gh/kin.fhir', 'code': 'KIN:035', 'display': 'hasGrandparent' },
  'KIN:036': { 'system': 'http://purl.org/ga4gh/kin.fhir', 'code': 'KIN:036', 'display': 'isGrandchild' },
  'KIN:037': { 'system': 'http://purl.org/ga4gh/kin.fhir', 'code': 'KIN:037', 'display': 'hasGrandchild' },
  'KIN:038': { 'system': 'http://purl.org/ga4gh/kin.fhir', 'code': 'KIN:038', 'display': 'isOvumDonor' },
  'KIN:039': { 'system': 'http://purl.org/ga4gh/kin.fhir', 'code': 'KIN:039', 'display': 'hasGestationalCarrier' },
  'KIN:040': { 'system': 'http://purl.org/ga4gh/kin.fhir', 'code': 'KIN:040', 'display': 'hasBiologicalFather' },
  'KIN:041': { 'system': 'http://purl.org/ga4gh/kin.fhir', 'code': 'KIN:041', 'display': 'hasBiologicalMother' },
  'KIN:042': { 'system': 'http://purl.org/ga4gh/kin.fhir', 'code': 'KIN:042', 'display': 'hasOvumDonor' },
  'KIN:043': { 'system': 'http://purl.org/ga4gh/kin.fhir', 'code': 'KIN:043', 'display': 'hasSurrogateOvumDonor' },
  'KIN:044': { 'system': 'http://purl.org/ga4gh/kin.fhir', 'code': 'KIN:044', 'display': 'hasSpermDonor' },
  'KIN:045': { 'system': 'http://purl.org/ga4gh/kin.fhir', 'code': 'KIN:045', 'display': 'hasGreatGrandParent' },
  'KIN:046': { 'system': 'http://purl.org/ga4gh/kin.fhir', 'code': 'KIN:046', 'display': 'hasParentalSibling' },
  'KIN:047': { 'system': 'http://purl.org/ga4gh/kin.fhir', 'code': 'KIN:047', 'display': 'isGreatGrandchild' },
  'KIN:048': { 'system': 'http://purl.org/ga4gh/kin.fhir', 'code': 'KIN:048', 'display': 'isBrokenPartner' },
  'KIN:049': { 'system': 'http://purl.org/ga4gh/kin.fhir', 'code': 'KIN:049', 'display': 'isBrokenConsanguineousPartner' },

};


GA4GHFHIRConverter.relationshipMap = {
  'NMTH':      'KIN:027',
  'NFTH':      'KIN:028',
  'NPRN':      'KIN:003',
  'ADOPTMTH':  'KIN:022',
  'ADOPTFTH':  'KIN:022',
  'ADOPTPRN':  'KIN:022',
  'SIGOTHR':   'KIN:026',
  'BROKEN_SIGOTHR':   'KIN:048',
  'CONSANG':   'KIN:030',
  'BROKEN_CONSANG':   'KIN:049',
  'TWIN':      'KIN:009',
  'TWINSIS':   'KIN:010',
  'TWINBRO':   'KIN:010',
  'FTWINSIS':  'KIN:011',
  'FTWINBRO':  'KIN:011',
};

GA4GHFHIRConverter.processTreeNode = function (index, pedigree, privacySetting, knownFhirPatienReference,
  pedigreeIndividuals, pedigreeRelationship, condtions, observations, nodeIndexToRef) {

  if (pedigreeIndividuals[index]) {
    // already processed
    return pedigreeIndividuals[index].id;
  }

  const nodeProperties = pedigree.GG.properties[index];
  const externalId = nodeProperties['externalID'];
  let ref = (knownFhirPatienReference && externalId && knownFhirPatienReference[externalId]) ? knownFhirPatienReference[externalId] : generateUUID();
  nodeIndexToRef[index] = ref;
  pedigreeIndividuals[index] = this.buildPedigreeIndividual(ref, nodeProperties, privacySetting);


  this.addConditions(nodeProperties, ref, condtions);

  this.addObservations(nodeProperties, ref, observations);

  let relationshipsToBuild = {};

  let isAdopted = pedigree.GG.isAdopted(index);
  let parents = pedigree.GG.getParents(index);

  let mother = pedigree.GG.getMother(index) || -1;
  let father = pedigree.GG.getFather(index) || -2;

  if (mother < index || father < index) {
    // could be no gender

    if (parents.length > 0) {
      if (mother === parents[0]) {
        father = parents[1];
      } else if (mother === parents[1]) {
        father = parents[0];
      } else if (father === parents[0]) {
        mother = parents[1];
      } else if (father === parents[1]) {
        mother = parents[0];
      }
    }
  }
  if (mother > 0) {
    relationshipsToBuild[mother] = (isAdopted) ? 'ADOPTMTH' : 'NMTH';
  }
  if (father > 0) {
    relationshipsToBuild[father] = (isAdopted) ? 'ADOPTFTH' : 'NFTH';
  }
  for (let i = 0; i < parents.length; i++) {
    if (!relationshipsToBuild[parents[i]]) {
      relationshipsToBuild[parents[i]] = (isAdopted) ? 'ADOPTPRN' : 'NPRN';
    }
  }

  // add partners
  let partners = pedigree.GG.getAllPartners(index);
  for (let i = 0; i < partners.length; i++) {
    if (!pedigreeIndividuals[partners[i]]) {
      relationshipsToBuild[partners[i]] = 'SIGOTHR';
      let relNode = pedigree.GG.getRelationshipNode(index, partners[i]);

      if (relNode != null) {
        let relProperties = pedigree.GG.properties[relNode];
        console.log('relProperties', relProperties);

        let consangr = relProperties['consangr'] ? relProperties['consangr'] : 'A';
        if (consangr === 'Y'){
          relationshipsToBuild[partners[i]] = 'CONSANG';
        } else if (consangr === 'A') {
          // spec says second cousins or closer, A second cousin is a someone who shares a great-grandparent with you
          // so make a list of parents going back 3 generations and look for any common nodes
          let myGreatGrandParents = pedigree.GG.getParentGenerations(index, 3);
          let partnerGreatGrandParents = pedigree.GG.getParentGenerations(partners[i], 3);
          for (let elem of myGreatGrandParents) {
            if (partnerGreatGrandParents.has(elem)) {
              // found common
              relationshipsToBuild[partners[i]] = 'CONSANG';
              break;
            }
          }
        }
        if (relProperties['broken']){
          relationshipsToBuild[partners[i]] = 'BROKEN_' + relationshipsToBuild[partners[i]];
        }
      }

    }
  }
  //add twins
  let twinGroupId = pedigree.GG.getTwinGroupId(index);
  if (twinGroupId != null) {
    // this person is a twin
    let siblingsToAdd = pedigree.GG.getAllTwinsOf(index);
    for (let i = 0; i < siblingsToAdd.length; i++) {
      if (siblingsToAdd[i] !== index) {
        let siblingId = siblingsToAdd[i];
        if (!pedigreeIndividuals[siblingId]) {
          let gender = pedigree.GG.getGender(siblingId);
          let monozygotic = pedigree.GG.properties[siblingId]['monozygotic'] === true;
          let rel = 'TWIN';
          if (gender === 'F') {
            rel = (monozygotic) ? 'TWINSIS' : 'FTWINSIS';
          } else if (gender === 'M') {
            rel = (monozygotic) ? 'TWINBRO' : 'FTWINBRO';
          }
          relationshipsToBuild[siblingId] = rel;
        }
      }
    }
  }
  for (let relIndex in relationshipsToBuild) {
    // recursion
    let relRef = this.processTreeNode(relIndex, pedigree, privacySetting, knownFhirPatienReference, pedigreeIndividuals,
      pedigreeRelationship, condtions, observations, nodeIndexToRef);
    pedigreeRelationship.push(this.buildPedigreeRelation(ref, relRef, relationshipsToBuild[relIndex]));
  }
  return ref;
};

GA4GHFHIRConverter.getReference = function(id) {
  if (id.startsWith('urn:uuid:')){
    return id;
  }
  return '#' + id;
};

GA4GHFHIRConverter.patRefAsId = function (ref) {
  if (ref.startsWith('Patient/')) {
    return ref.substring(8);
  }
  return ref;
};

GA4GHFHIRConverter.patRefAsRef = function (ref) {
  if (ref.startsWith('Patient/')) {
    return ref;
  }
  return this.getReference(ref);
};


GA4GHFHIRConverter.buildPedigreeIndividual = function (containedId, nodeProperties, privacySetting) {
  let patientResource = {
    'id': this.patRefAsId(containedId),
    'resourceType': 'Patient',
    'meta': {
      'profile': [
        'http://purl.org/ga4gh/pedigree-fhir-ig/StructureDefinition/PedigreeIndividual'
      ]
    },
    'extension': []
  };

  // sex
  if (nodeProperties.gender) {
    if (nodeProperties.gender === 'M') {
      patientResource.gender = 'male';
    } else if (nodeProperties.gender === 'F') {
      patientResource.gender = 'female';
    } else {
      patientResource.gender = 'unknown';
    }
  }
  let unbornFlag = false;
  if (privacySetting === 'all') {
    if (nodeProperties['dob']) {
      let d = new Date(nodeProperties['dob']);
      patientResource['birthDate'] = d.getFullYear() + '-'
        + (d.getMonth() < 9 ? '0' : '') + (d.getMonth() + 1) + '-' + (d.getDate() <= 9 ? '0' : '') + d.getDate();
    }
    if (nodeProperties['dod']) {
      let d = new Date(nodeProperties['dod']);
      patientResource['deceasedDateTime'] = d.getFullYear() + '-'
        + (d.getMonth() < 9 ? '0' : '') + (d.getMonth() + 1) + '-' + (d.getDate() <= 9 ? '0' : '') + d.getDate();
    } else if (nodeProperties['lifeStatus']) {
      let lifeStatus = nodeProperties['lifeStatus'];
      if (lifeStatus === 'stillborn' || lifeStatus === 'miscarriage' || lifeStatus === 'aborted' || lifeStatus === 'unborn') {
        unbornFlag = true;
        if (nodeProperties.hasOwnProperty('gestationAge')) {
          patientResource['deceasedString'] = lifeStatus + ' ' + nodeProperties['gestationAge'] + ' weeks';
        } else {
          patientResource['deceasedString'] = lifeStatus;
        }
      } else if (lifeStatus === 'deceased') {
        patientResource['deceasedBoolean'] = true;
      }
    }
  } else {
    if (nodeProperties['dod']) {
      patientResource['deceasedBoolean'] = true;
    } else if (nodeProperties['lifeStatus']) {
      let lifeStatus = nodeProperties['lifeStatus'];
      if (lifeStatus === 'stillborn' || lifeStatus === 'miscarriage' || lifeStatus === 'aborted' || lifeStatus === 'unborn') {
        unbornFlag = true;
        if (nodeProperties.hasOwnProperty('gestationAge')) {
          unbornFlag = true;
          patientResource['deceasedString'] = lifeStatus + ' ' + nodeProperties['gestationAge'] + ' weeks';
        } else {
          unbornFlag = true;
          patientResource['deceasedString'] = lifeStatus;
        }
      } else if (lifeStatus === 'deceased') {
        unbornFlag = true;
        patientResource['deceasedBoolean'] = true;
      }
    }
  }

  patientResource.extension.push({
    'url': 'http://purl.org/ga4gh/pedigree-fhir-ig/StructureDefinition/patient-unborn',
    'valueBoolean': unbornFlag
  }
  );

  if (nodeProperties.twinGroup) {
    patientResource.multipleBirthBoolean = true;
  }

  // name
  if (privacySetting === 'all') {

    if (nodeProperties.lName || nodeProperties.fName || nodeProperties.lNameAtB) {
      patientResource.name = [];
      if (nodeProperties.lName || nodeProperties.fName) {
        let name = {};
        if (nodeProperties.lName) {
          name.family = nodeProperties.lName;
        }
        if (nodeProperties.fName) {
          name.given = [nodeProperties.fName];
        }
        patientResource.name.push(name);
      }
      if (nodeProperties.lNameAtB && nodeProperties.lNameAtB !== nodeProperties.lName) {
        let name = {
          'use': 'old',
          'family': nodeProperties.lNameAtB
        };
        patientResource.name.push(name);
      }
    }
  }
  return patientResource;
};

GA4GHFHIRConverter.buildPedigreeRelation = function (ref, relRef, relationship) {
  return {
    'resourceType': 'FamilyMemberHistory',
    'id': generateUUID(),
    'meta': {
      'profile': [
        'http://purl.org/ga4gh/pedigree-fhir-ig/StructureDefinition/PedigreeRelationship'
      ]
    },
    'extension': [
      {
        'url': 'http://hl7.org/fhir/StructureDefinition/familymemberhistory-patient-record',
        'valueReference': {
          'reference': this.patRefAsRef(relRef)
        }
      }
    ],
    'status': 'completed',
    'patient': {
      'reference': this.patRefAsRef(ref)
    },
    'relationship': {
      'coding': [
        GA4GHFHIRConverter.familyHistoryLookup[GA4GHFHIRConverter.relationshipMap[relationship]]
      ]
    }
  };
};

GA4GHFHIRConverter.addConditions = function (nodeProperties, ref, condtions) {
  let conditionsForRef = [];
  let fhirTerminologyHelper = editor.getFhirTerminologyHelper();
  if (nodeProperties['disorders']) {
    let disorders = nodeProperties['disorders'];
    let disorderLegend = editor.getDisorderLegend();
    for (let i = 0; i < disorders.length; i++) {
      let disorderTerm = disorderLegend.getTerm(disorders[i]);
      let fhirCondition = {
        'resourceType': 'Condition',
        'id': generateUUID(),
        'subject': {
          'reference': this.patRefAsRef(ref)
        },
        code: fhirTerminologyHelper.getCodeableConceptFromDisorder(disorders[i])
      };

      conditionsForRef.push(fhirCondition);
    }
  }
  condtions[ref] = conditionsForRef;
};

GA4GHFHIRConverter.addObservations = function (nodeProperties, ref, observations) {
  let observationsForRef = [];
  let fhirTerminologyHelper = editor.getFhirTerminologyHelper();
  const phenotypePrefix = 'phenotype: ';
  const genePrefix = 'gene: ';

  if (nodeProperties['hpoTerms']) {
    let hpoTerms = nodeProperties['hpoTerms'];

    for (let j = 0; j < hpoTerms.length; j++) {
      let fhirObservation = {
        'resourceType': 'Observation',
        'id': generateUUID(),
        'status': 'preliminary',
        'subject': { 'reference': this.patRefAsRef(ref) }
      };
      let cc = fhirTerminologyHelper.getCodeableConceptFromPhenotype(hpoTerms[j]);
      if (cc.coding){
        fhirObservation['valueCodeableConcept'] = cc;
      } else {
        fhirObservation['valueString'] = phenotypePrefix + hpoTerms[j];
      }
      observationsForRef.push(fhirObservation);
    }
  }

  if (nodeProperties['candidateGenes']) {
    let candidateGenes = nodeProperties['candidateGenes'];
    for (let j = 0; j < candidateGenes.length; j++) {
      // @TODO change to use http://build.fhir.org/ig/HL7/genomics-reporting/obs-region-studied.html
      let fhirObservation = {
        'resourceType': 'Observation',
        'id': generateUUID(),
        'status': 'preliminary',
        'subject': { 'reference': this.patRefAsRef(ref)}
      };
      let cc = fhirTerminologyHelper.getCodeableConceptFromGene(candidateGenes[j]);
      if (cc.coding){
        fhirObservation['valueCodeableConcept'] = cc;
      } else {
        fhirObservation['valueString'] = genePrefix + candidateGenes[j];
      }
      observationsForRef.push(fhirObservation);
    }
  }

  //carrierStatus -'affected' or 'carrier' 'presymptomatic'
  // For carrier status:
  // Carrier:
  //   Code: 87955000 | Carrier state, disease expressed |
  //   Value: empty
  // Pre-symptomatic:
  //   Code: 24800002 | Carrier state, disease not expressed |
  //   Value: empty
  if (nodeProperties['carrierStatus']) {
    let carrierCode = undefined;
    if (nodeProperties['carrierStatus'] === 'carrier') {
      carrierCode = {
        'coding': [{
          'system': 'http://snomed.info/sct',
          'code': '87955000',
          'display': 'Carrier state, disease expressed'
        }]
      };
    } else if (nodeProperties['carrierStatus'] === 'presymptomatic') {
      carrierCode = {
        'coding': [{
          'system': 'http://snomed.info/sct',
          'code': '24800002',
          'display': 'Carrier state, disease not expressed'
        }]
      };
    }
    if (carrierCode) {
      let fhirObservation = {
        'resourceType': 'Observation',
        'id': generateUUID(),
        'status': 'preliminary',
        'valueCodeableConcept': carrierCode,
        'subject': { 'reference': this.patRefAsRef(ref) }
      };
      observationsForRef.push(fhirObservation);
    }
  }
  //childlessStatus - 'childless' or 'infertile'
  //Childless:
  //   Code: 224118004 | Number of offspring |
  //   Value: 0
  // Infertile:
  //   Code: 8619003 | Infertile |
  //   Value: empty
  if (nodeProperties['childlessStatus']) {
    let childlessCode = undefined;
    let addZeroValue = false;
    if (nodeProperties['childlessStatus'] === 'childless') {
      childlessCode = {
        'coding': [{
          'system': 'http://snomed.info/sct',
          'code': '224118004',
          'display': 'Number of offspring'
        }]
      };
      addZeroValue = true;
    } else if (nodeProperties['childlessStatus'] === 'infertile') {
      childlessCode = {
        'coding': [{
          'system': 'http://snomed.info/sct',
          'code': '8619003',
          'display': 'Infertile'
        }]
      };
    }
    if (childlessCode) {
      let fhirObservation = {
        'resourceType': 'Observation',
        'id': generateUUID(),
        'status': 'preliminary',
        'code': childlessCode,
        'subject': { 'reference': this.patRefAsRef(ref) }
      };
      if (addZeroValue){
        fhirObservation.valueInteger = 0;
      }
      observationsForRef.push(fhirObservation);
    }
  }
  // add comments as an observation
  if (nodeProperties['comments']) {
    let fhirObservation = {
      'resourceType': 'Observation',
      'id': generateUUID(),
      'status': 'preliminary',
      'code': {
        'coding': [{
          'system': 'http://loinc.org',
          'code': '48767-8',
          'display': 'Annotation comment [Interpretation] Narrative'
        }]
      },
      'subject': { 'reference': this.patRefAsRef(ref) },
      'valueString': nodeProperties['comments']
    };
    observationsForRef.push(fhirObservation);
  }

  // add lost contact as an observation
  if (nodeProperties['lostContact']) {
    let fhirObservation = {
      'resourceType': 'Observation',
      'id': generateUUID(),
      'status': 'preliminary',
      'code': {
        'coding': [{
          'system': 'http://snomed.info/sct',
          'code': '441879005',
          'display': 'No contact with family'
        }]
      },
      'subject': { 'reference': this.patRefAsRef(ref) },
      'valueString': 'Lost contact with proband'
    };
    observationsForRef.push(fhirObservation);
  }
  // add evaluated as an observation
  if (nodeProperties['evaluated']) {
    let fhirObservation = {
      'resourceType': 'Observation',
      'id': generateUUID(),
      'status': 'preliminary',
      'code': {
        'coding': [{
          'system': 'http://loinc.org',
          'code': '96172-2',
          'display': 'Clinical genetics Evaluation note'
        }]
      },
      'subject': { 'reference': this.patRefAsRef(ref) },
      'valueBoolean': true
    };
    observationsForRef.push(fhirObservation);
  }

  observations[ref] = observationsForRef;
};
//===============================================================================================

export default GA4GHFHIRConverter;
