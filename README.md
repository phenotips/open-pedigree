<p align="center">
  <img src="https://repository-images.githubusercontent.com/212736090/2759df80-fe9e-11e9-8fa0-8237e35cbaf7" width="400px" alt="Open Pedigree logo"/>
</p>

<p align="center">
  <a href="https://github.com/phenotips/open-pedigree/actions/workflows/ci.yml">
    <img src="https://github.com/phenotips/open-pedigree/actions/workflows/ci.yml/badge.svg?branch=master" alt="Build status">
  </a>
  <a href="https://opensource.org/licenses/LGPL-2.1" target="_blank">
    <img src="https://img.shields.io/badge/license-LGPL--2.1-blue.svg" alt="LGPL-2.1">
  </a>
</p>


## A free and open-source pedigree tool powered by PhenoTips®

Open Pedigree is a robust browser-based genomic pedigree drawing solution using [Prototype](prototypejs.org), [Raphaël](https://dmitrybaranovskiy.github.io/raphael/), and [PhenoTips](https://phenotips.com).

<img width="983" alt="image" src="https://user-images.githubusercontent.com/4251264/68103796-e1048080-fe9d-11e9-9353-6b491aae588d.png">


## Features

✔ Robust support for complex families, intergenerational linkages, and consanguinity

✔ Shade nodes with disorders and/or candidate genes

✔ Quickly start with family templates

✔ Automatic consanguinity detection

✔ Import from PED, LINKAGE, GEDCOM (Cyrillic), BOADICEA, or GA4GH Pedigree (FHIR)


## Getting started

### Command line

Quickly get started with open pedigree on your computer:
```
git clone git@github.com:phenotips/open-pedigree.git
cd open-pedigree
npm install
npm start
```
Open a browser to http://localhost:9000/

### Docker

You can also use the supplied Docker image to run the applicarion.  To get started:

```
git clone git@github.com:phenotips/open-pedigree.git
cd open-pedigree
docker build . -t open-pedigree
docker run -p 9000:9000 -d open-pedigree
```

## Contributing

Contributions welcome! Fork the repository and create a pull request to share your improvements with the community.

In order to ensure that the licensing is clear and stays open, you'll be asked to sign a CLA with your first pull request.


## Support

This is free software! Create an issue in GitHub to ask others for help, or try fixing the issue yourself and then make a pull request to contribute it back to the core.

If you are interested in the Enterprise/commercial version, please contact [PhenoTips](https://phenotips.com/).


## License

Copyright (c) 2019-2022 Gene42 Inc. o/a PhenoTips

Open Pedigree is distributed under the [LGPL-2.1](https://opensource.org/licenses/LGPL-2.1) (GNU Lesser General Public License).

You can easily comply with this license by:
* including prominent notice of the use of Open Pedigree in your software
* retaining all copyright notices in the software
* ensuring that any and all changes you make to the software are published and open-sourced under the LGPL
