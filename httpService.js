import axios from "axios";

const baseApiUrl = "http://localhost:2410";

function get(url) {
  return axios.get(baseApiUrl + url);
}
function post(url, obj) {
  return axios.post(baseApiUrl + url, obj);
}
function put(url, obj) {
  return axios.put(baseApiUrl + url, obj);
}

function deleteApi(url, obj) {
  return axios.delete(baseApiUrl + url);
}

export default {
  get,
  post,
  put,
  deleteApi,
};
