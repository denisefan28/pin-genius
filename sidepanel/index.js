import {
    GoogleGenerativeAI,
    HarmBlockThreshold,
    HarmCategory
  } from '../node_modules/@google/generative-ai/dist/index.mjs';

const apiKey = 'AIzaSyBjlSEzlTt7i4t7eR_xKQycJOPk3ori3WU';

let genAI = null;
let model = null;
const buttonPrompt = document.body.querySelector('#button-prompt');
const elementResponse = document.body.querySelector('#response');
const elementLoading = document.body.querySelector('#loading');
const elementError = document.body.querySelector('#error');


function initModel(generationConfig) {
    console.log("Init model ...")
    const safetySettings = [
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_NONE
      }
    ];
    genAI = new GoogleGenerativeAI(apiKey);
    model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      safetySettings,
      generationConfig
    });
    return model;
  }


  async function runPrompt(prompt) {
    try {
     // parset the element of <div id="typedUrl_div"></div> to get the browser history
      const typedUrlDiv = document.getElementById('typedUrl_div');
      // convert the element to an array of URLs
      const urls = Array.from(typedUrlDiv.querySelectorAll('a')).map(a => a.href);
      // convert the array of URLs to a string
      const urlsString = urls.join('\n');
      const prompt = "Generate a to-do list based on the below browser history, response in bullet points. \n" + urlsString;
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (e) {
      console.log('Prompt failed');
      console.error(e);
      console.log('Prompt:', prompt);
      throw e;
    }
  }

  buttonPrompt.addEventListener('click', async () => {
    showLoading();
    try {
      const generationConfig = {
        temperature: 1.0
      };
      initModel(generationConfig);
      const response = await runPrompt(prompt, generationConfig);
      showResponse(response);
    } catch (e) {
      showError(e);
    }
  });

  function showLoading() {
    hide(elementResponse);
    hide(elementError);
    show(elementLoading);
  }
  
  function showResponse(response) {
    hide(elementLoading);
    show(elementResponse);
    // Make sure to preserve line breaks in the response
    elementResponse.textContent = '';
    const paragraphs = response.split(/\r?\n/);
    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i];
      if (paragraph) {
        elementResponse.appendChild(document.createTextNode(paragraph));
      }
      // Don't add a new line after the final paragraph
      if (i < paragraphs.length - 1) {
        elementResponse.appendChild(document.createElement('BR'));
      }
    }
  }

// Given an array of URLs, build a DOM list of those URLs in the
// browser action popup.
function buildPopupDom(divName, data) {
    let popupDiv = document.getElementById(divName);
  
    let ul = document.createElement('ul');
    popupDiv.appendChild(ul);
  
    for (let i = 0, ie = data.length; i < ie; ++i) {
      let a = document.createElement('a');
      a.href = data[i];
      a.appendChild(document.createTextNode(data[i]));
  
      let li = document.createElement('li');
      li.appendChild(a);
  
      ul.appendChild(li);
    }
  }
  
  // Search history to find up to ten links that a user has typed in,
  // and show those links in a popup.
  function buildTypedUrlList(divName) {
    // To look for history items visited in the last week,
    // subtract a week of milliseconds from the current time.
    let millisecondsPerWeek = 1000 * 60 * 60 * 24 * 7;
    let oneWeekAgo = new Date().getTime() - millisecondsPerWeek;
  
    // Track the number of callbacks from chrome.history.getVisits()
    // that we expect to get.  When it reaches zero, we have all results.
    let numRequestsOutstanding = 0;
  
    chrome.history.search(
      {
        text: '', // Return every history item....
        startTime: oneWeekAgo // that was accessed less than one week ago.
      },
      function (historyItems) {
        // For each history item, get details on all visits.
        for (let i = 0; i < historyItems.length; ++i) {
          let url = historyItems[i].url;
          let processVisitsWithUrl = function (url) {
            // We need the url of the visited item to process the visit.
            // Use a closure to bind the  url into the callback's args.
            return function (visitItems) {
              processVisits(url, visitItems);
            };
          };
          chrome.history.getVisits({ url: url }, processVisitsWithUrl(url));
          numRequestsOutstanding++;
        }
        if (!numRequestsOutstanding) {
          onAllVisitsProcessed();
        }
      }
    );
  
    // Maps URLs to a count of the number of times the user typed that URL into
    // the omnibox.
    let urlToCount = {};
  
    // Callback for chrome.history.getVisits().  Counts the number of
    // times a user visited a URL by typing the address.
    const processVisits = function (url, visitItems) {
      for (let i = 0, ie = visitItems.length; i < ie; ++i) {
        // Ignore items unless the user typed the URL.
        // if (visitItems[i].transition != 'typed') {
        //   continue;
        // }
  
        if (!urlToCount[url]) {
          urlToCount[url] = 0;
        }
  
        urlToCount[url]++;
      }
  
      // If this is the final outstanding call to processVisits(),
      // then we have the final results.  Use them to build the list
      // of URLs to show in the popup.
      if (!--numRequestsOutstanding) {
        onAllVisitsProcessed();
      }
    };
  
    // This function is called when we have the final list of URls to display.
    const onAllVisitsProcessed = () => {
      // Get the top scorring urls.
      let urlArray = [];
      for (let url in urlToCount) {
        urlArray.push(url);
      }
  
      // Sort the URLs by the number of times the user typed them.
      urlArray.sort(function (a, b) {
        return urlToCount[b] - urlToCount[a];
      });
  
      buildPopupDom(divName, urlArray.slice(0, 10));
    };
  }


function showError(error) {
    show(elementError);
    hide(elementResponse);
    hide(elementLoading);
    elementError.textContent = error;
  }
  
  function show(element) {
    element.removeAttribute('hidden');
  }
  
  function hide(element) {
    element.setAttribute('hidden', '');
  }
  
  document.addEventListener('DOMContentLoaded', function () {
    buildTypedUrlList('typedUrl_div');
  });