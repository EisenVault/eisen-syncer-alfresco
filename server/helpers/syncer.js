const fetch = require("node-fetch");
const FormData = require("form-data");

exports.upload = async () => {
  const form = new FormData();
  form.append("filedata");
  form.append("filename", "facebook.png");
  form.append(
    "destination",
    "workspace://SpacesStore/ea190343-a462-4794-95a0-12e010b2be8d"
  );
  form.append("uploadDirectory", "test");
  form.append("overwrite", false);

  await fetch("https://systest.eisenvault.net/alfresco/service/api/upload", {
    method: "POST",
    body: form
  });
};
