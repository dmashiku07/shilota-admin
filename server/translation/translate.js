
langTranslate = function(text, language) {
  const en = require("./en");
  const ar = require("./ar");
  const fr = require("./fr");
  if(language == "ar")
  {

    return ar[text];
  }
  else if(language == "en")
  {

    return en[text];
  }
  else if(language == "fr")
  {

    return fr[text];
  }
  else
  {
    return en[text];
  }
};

module.exports = {
  langTranslate: langTranslate,

};
