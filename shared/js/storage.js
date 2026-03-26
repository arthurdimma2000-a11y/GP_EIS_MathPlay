(function(global){
  "use strict";

  function safeParse(value, fallback){
    if (typeof value !== "string" || value === "") return fallback;
    try{
      return JSON.parse(value);
    }catch(_err){
      return fallback;
    }
  }

  function getJSON(key, fallback){
    try{
      return safeParse(global.localStorage.getItem(key), fallback);
    }catch(_err){
      return fallback;
    }
  }

  function setJSON(key, value){
    try{
      global.localStorage.setItem(key, JSON.stringify(value));
      return true;
    }catch(_err){
      return false;
    }
  }

  function appendJSON(key, item, fallback){
    const list = getJSON(key, Array.isArray(fallback) ? fallback.slice() : []);
    if (!Array.isArray(list)) return false;
    list.push(item);
    return setJSON(key, list);
  }

  function remove(key){
    try{
      global.localStorage.removeItem(key);
      return true;
    }catch(_err){
      return false;
    }
  }

  global.GPStorage = {
    safeParse,
    getJSON,
    setJSON,
    appendJSON,
    remove
  };
})(window);
