/*
Copyright (C) Jixin Jia (Gin)
Created for Microsoft GBB AI Solutions Demo Portal
Component:  Contact Center AI Demo js component
Author:     Jixin Jia (Gin)
*/

var loading = '<span class="loader"></span>';
var micStandbyIcon = '<i class="fa fa-spinner fa-spin fa-2x fa-fw"></i>';
var micReadyIcon = '<i class="bi bi-mic-fill text-4xl"></i>';

// Speech Recognition & Translation with Speech SDK
var SpeechSDK;
var recognizer;
var startAsyncButton = $("#startAsyncButton");
var stopAsyncButton = $("#stopAsyncButton");
var azureAIKey = $("#azureAIKey").val();
var azureAIRegion = $("#azureAIRegion").val();
var speechLang = $('select#speechLang').val();
var azureAIEndpoint = $("#azureAIEndpoint").val();
var translatorKey = $("#translatorKey").val();
var translatorRegion = $("#translatorRegion").val();
var translateLang = $('select#translateLang').val();
var translateLangLabel = $('select#translateLang option:selected').text();
var displaySpeech = $("#displaySpeech");
var displayTranslation = $("#displayTranslation");
var divRecognized = $('#divRecognized');
var divTranslated = $('#divTranslated');
var aoaiKey = $("#aoaiKey").val();
var aoaiEndpoint = $("#aoaiEndpoint").val();
var aoaiModel = $("#aoaiModel").val();
var divNER = $('#divNER');
var divOpenAICard = $('#divOpenAICard');
var divOpenAI = $('#divOpenAI');
var divOpenAISpinner = $('#divOepnAISpinner');
var detectedLang = 'en';
var speakerID = 'Guest-1';
var defaultSpeakerId = 'Guest-1';
var divFullReport = $('#divFullReport');

// Update parameter selection
$("select#speechLang").change(function() {
    speechLang = $(this).children("option:selected").val();
});
$("select#translateLang").change(function() {
    translateLang = $(this).children("option:selected").val();
    translateLangLabel = $(this).children("option:selected").text();
});
$("#azureAIKey").change(function() {
    azureAIKey = $(this).val();
});
$("#azureAIRegion").change(function() {
    azureAIRegion = $(this).val();
});
$("#azureAIEndpoint").change(function() {
    azureAIEndpoint = $(this).val();
});
$("#translatorKey").change(function() {
    translatorKey = $(this).val();
});
$("#translatorRegion").change(function() {
    translatorRegion = $(this).val();
});
$("#aoaiKey").change(function() {
    aoaiKey = $(this).val();
});
$("#aoaiEndpoint").change(function() {
    aoaiEndpoint = $(this).val();
});
$("#aoaiModel").change(function() {
    aoaiModel = $(this).val();
});

/*
 Common Utilities
*/

function appendToLocalStorage(key, value) {
    var contents = getLocalStorage(key);
    localStorage.setItem(key, value + contents);
}

function getLocalStorage(key) {
    var contents = localStorage.getItem(key);
    if (contents === null) {
        return '';
    }
    else {
        return contents;
    }
}

function getSpeakerColor(speakerID) {
    const colorNames = ['info', 'warning', 'danger', 'success', 'light'];
  
    // Extract number from 'Guest-1', 'Guest-2', etc.
    const match = speakerID.match(/(\d+)/);
    if (!match) return 'light'; // fallback if format is unexpected
    const num = parseInt(match[1], 10);
    const index = (num - 1) % colorNames.length;
  
    return colorNames[index];
  }

let recognizerStarted = false;
let transcriberStarted = false;

function checkSpeechStatus() {
    if (recognizerStarted && transcriberStarted) {
        console.log("Recognizer and transcriber started!");
        stopAsyncButton.html(micReadyIcon);
    }
}


// DOM load
$(document).ready(function() {  
    
    // Show pre-loading page
    var random_queue_time = Math.floor(Math.random() * (2000 - 500 + 1)) + 500;
    
    setTimeout(function(){
        if (!!window.SpeechSDK) {
            SpeechSDK = window.SpeechSDK;
            startAsyncButton.disabled = false;
            $('#warning').hide();
            $('#demo-container').show();
        }
    }, random_queue_time);
    
    // Start audio stream
    startAsyncButton.on("click", function(event) {
        
        // Key validation 
        var forms = document.querySelectorAll('.needs-validation');
        Array.prototype.slice.call(forms).forEach(function (form) {
            if (!form.checkValidity()) {
                event.preventDefault()
                event.stopPropagation()
            }
            form.classList.add('was-validated')
        })

        if (!forms[0].checkValidity()) {
            // Open setup page
            console.log('Keys not set. opening setup page');
            
            var myOffcanvas = $('#offcanvas')
            var bsOffcanvas = new bootstrap.Offcanvas(myOffcanvas)
            bsOffcanvas.show();
        }
        else {
            // Toggle mic on/off button
            startAsyncButton.hide();
            stopAsyncButton.show();

            // Reset local storage
            localStorage.clear();
            
            // Audio setup
            const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
            
            // Continuous LID setup
            const autoDetectSourceLanguageConfig = SpeechSDK.AutoDetectSourceLanguageConfig.fromLanguages(["en-US", "ja-JP", "zh-CN", "ko-KR", "es-ES", "de-DE", "fr-FR"]);
            
            // Speech config with Continuous LID and Transcriber Diarization
            const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(azureAIKey, azureAIRegion);
            speechConfig.setProperty(SpeechSDK.PropertyId.SpeechServiceConnection_LanguageIdMode, "Continuous");
            speechConfig.setProperty(SpeechSDK.PropertyId.SpeechServiceConnection_SpeakerDiarizationMode,"True");
            const recognizer =  SpeechSDK.SpeechRecognizer.FromConfig(speechConfig, autoDetectSourceLanguageConfig, audioConfig);
            const transcriber = SpeechSDK.ConversationTranscriber.FromConfig(speechConfig, autoDetectSourceLanguageConfig, audioConfig);

            // Start recognition
            recognizer.startContinuousRecognitionAsync(() => {
                recognizerStarted = true;
                checkSpeechStatus();
            }, (err) => {
                console.error("Recognizer failed to start:", err);
            });
            
            transcriber.startTranscribingAsync(() => {
                transcriberStarted = true;
                checkSpeechStatus();
            }, (err) => {
                console.error("Transcriber failed to start:", err);
            });
            
            // Event handling
            recognizer.recognizing = (s, e) => {
                var timeNow = new Date();
                var timeLabel = timeNow.toLocaleString('en-US', { timeStyle: 'medium', hour12: false});
                var displayText = `[${timeLabel}] ${e.result.text}<br>`;
                
                displaySpeech.html(displayText + getLocalStorage('recognized'));
            };
            
            transcriber.transcribed = function(s, e) {
                if (e.result.text) {
                    var speakerID = e.result.speakerId == 'Unknonwn' ? defaultSpeakerId : e.result.speakerId;
                    var speakerColor = getSpeakerColor(speakerID);
                    var displayText = `<span class="text-${speakerColor}">[${speakerID}]</span> ${e.result.text}<br>`;
                    displaySpeech.html(displayText + getLocalStorage('recognized'));   
                    appendToLocalStorage('recognized', displayText);

                    // Trigger Translation
                    runTranslation(speakerID, e.result.text);
                }
                
                // if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech || e.result.reason == SpeechSDK.ResultReason.TranslatedSpeech) {
                //     speakerID = e.result.speakerId ? e.result.speakerId : defaultSpeakerId;
                //     langDetected = SpeechSDK.AutoDetectSourceLanguageResult.fromResult(e.result);
                //     transcribed = $`[${speakerID}] ${e.result.text} (${langDetected.language})`;
                //     appendToLocalStorage('recognized', transcribed);
                //     displaySpeech.html(transcribed);
                //     console.log("TRANSCRIBED: " + e.result.text + "Speaker ID=" + e.result.speakerId);
                // } else {
                //     console.log(`Transcriber encountered an error (${e.result.reason})`);
                // }
            };

            recognizer.recognized = (s, e) => {
                if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech || e.result.reason == SpeechSDK.ResultReason.TranslatedSpeech) {
                    const langDetectResult = SpeechSDK.AutoDetectSourceLanguageResult.fromResult(e.result);
                    const detectedLang = langDetectResult.language;
                    console.log(`Detected Language: ${detectedLang}`);
                    
                    // Trigger Sentiment Analysis & Translation
                    runSentimentAnalysis(e.result.text, detectedLang);

                } else if (e.result.reason === SpeechSDK.ResultReason.NoMatch) {
                    console.log("NOMATCH: Speech could not be recognized.");
                }
            };
            
            recognizer.canceled = (s, e) => {
                console.log(`CANCELED: Reason=${e.reason}`);
                if (e.reason === SpeechSDK.CancellationReason.Error) {
                    console.log(`CANCELED: ErrorCode=${e.errorCode}`);
                    console.log(`CANCELED: ErrorDetails=${e.errorDetails}`);
                    console.log("CANCELED: Did you set the speech resource key and region values?");
                }
                recognizer.stopContinuousRecognitionAsync();
            };
            
            recognizer.sessionStopped = (s, e) => {
                console.log("Session stopped.");
                recognizer.stopContinuousRecognitionAsync();
            };
            

            // Stop Aysnc Button
            stopAsyncButton.on("click", function () {
                recognizer.stopContinuousRecognitionAsync();
                startAsyncButton.show();
                stopAsyncButton.hide();
                stopAsyncButton.html(micStandbyIcon);
                runGPT();
            });
        }
    });
});


// Trigger Translation
function runTranslation(speakerID, text) {    
    const body = [{text: text}];
    const params = {
        'api-version': '3.0',
        'to': translateLang 
    };
    const headers = {
        'Ocp-Apim-Subscription-Key': translatorKey,
        'Ocp-Apim-Subscription-Region': translatorRegion,
        'Content-type': 'application/json'
    };
    const url = 'https://api.cognitive.microsofttranslator.com/translate';
    axios.post(url, body, { params, headers })
        .then(response => {
            // console.log(JSON.stringify(response.data, null, 2));
            const translatedText = response.data[0].translations[0].text;
            const displayText = translatedText + '<br>';
            const speakerColor = getSpeakerColor(speakerID);
            displayTranslation.html(`<span class="text-${speakerColor}">[${speakerID}]</span> ${displayText}` + getLocalStorage('translated'));
            appendToLocalStorage('translated', `<span class="text-${speakerColor}">[${speakerID}]</span> ${displayText}`);
        })
        .catch(error => {
            console.error('Translation API error:', error.response ? error.response.data : error.message);
        });
};

// Trigger OpenAI
function processEntities(input) {
    const className = "badge badge-success rounded-pill text-light px-3 mb-1 me-1 text-s lh-base";
    return input
      .split(",")
      .map(kw => kw.trim())
      .filter(kw => kw)
      .map(kw => `<span class="${className}">${kw}</span>`)
      .join("\n");
  }

function runGPT() {
    // Check if transcription contains any letter (a-z, A-Z) or digit (0-9), if not stop processing
    if (/[a-zA-Z0-9]/.test($("#displaySpeech").text()) === false) {
        return;
    }
    var form_data = JSON.stringify({
        transcription: $("#displaySpeech").html(),
        aoaiKey: aoaiKey,
        aoaiEndpoint: aoaiEndpoint,
        aoaiModel: aoaiModel,
        lang: translateLangLabel,
      });
      $.ajax({
        url: $SCRIPT_ROOT + '/gpt',
        type: 'POST',
        contentType: 'application/json;charset=UTF-8',
        data: form_data,
        dataType: 'json',
        beforeSend: function() {
            divOpenAI.html(loading);
        }
      }).done(function(response) {
        if (response.status == 'ok') {
            var entityHTML = processEntities(response.q3);
            divOpenAI.removeClass('align-items-center');
            divOpenAI.removeClass('justify-content-center');
            divOpenAI.html(`
            <div class="h5" style="text-align: start;">
                <h6 class="openai_subheading">重要ポイント</h6>
                <p class="mute text-m">${response.q1}</p>
                <h6 class="openai_subheading">カテゴリ</h6>
                <p class="mute text-m">${response.q4}</p>
                <h6 class="openai_subheading">キーワード</h6>
                <p>${entityHTML}</p>
            </div>
            `);
            divFullReport.html(`
                <p class="modal_subheading">会話の主旨</p>
                <p class="modal_text">${response.q5}</p>
                <p class="modal_subheading">詳細</p>
                <p class="modal_text">${response.q1}</p>
                <p class="modal_subheading">結果</p>
                <p class="modal_text">${response.q6}</p>
                <p class="modal_subheading">フォローアップ</p>
                <p class="modal_text">${response.q7}</p>
                <p class="modal_subheading">トピック</p>            
                <p>${entityHTML}</p>
                <p class="modal_subheading">カテゴリ</p>
                <p class="modal_text">${response.q4}</p>
                <p class="modal_subheading">主な参加者</p>
                <p class="modal_text">${response.q8}</p>
                <p class="modal_subheading">感情スコア</p>
                <p class="sentiment_score">${response.q2}</p>
                `);
        } else {
          divOpenAI.html(response.error);
        }
      });
};

// Trigger NER
function runNER(text, langCode) {
    var payload = { 
        documents: [
            { id: "1", language: langCode, text: text}
        ]
    };

    axios({
        method: 'POST',
        url: `${azureAIEndpoint}/text/analytics/v3.2-preview.2/entities/recognition/general`,
        headers: {'Content-Type': 'application/json', 'Ocp-Apim-Subscription-Key': azureAIKey},
        data: payload,
        responseType: 'json',
    }).then(response => {
        var results = '';
        entities = response.data.documents[0].entities;
        entities.forEach(el => {
            switch(el.category) {
                case 'IP':
                    bootstrap_icon = 'globe';
                    break;
                case 'URL':
                    bootstrap_icon = 'globe';
                    break;
                case 'Email':
                    bootstrap_icon = 'mailbox';
                    break;
                case 'PhoneNumber':
                    bootstrap_icon = 'telephone';
                    break;
                case 'Address':
                    bootstrap_icon = 'geo-alt';
                    break;
                case 'Product':
                    bootstrap_icon = 'box-seam';
                    break;
                case 'Location':
                    bootstrap_icon = 'pin-map';
                    break;
                case 'DateTime':
                    bootstrap_icon = 'calendar-date';
                    break;
                case 'Person':
                    bootstrap_icon = 'person';
                    break;
                case 'PersonType':
                    bootstrap_icon = 'file-earmark-person';
                    break;
                case 'Event':
                    bootstrap_icon = 'controller';
                    break;
                case 'Quantity':
                    bootstrap_icon = 'percent';
                    break;
                case 'Organization':
                    bootstrap_icon = 'building';
                    break;
                case 'Skill':
                    bootstrap_icon = 'mortarboard';
                    break;
                default:
                    bootstrap_icon = 'microsoft';
            }
            // synthesize HTML span tag for NER
            results += `<span class="badge rounded-pill px-3 my-1 mx-1 text-light text-s lh-base ner-${el.category}"><i class="bi bi-${bootstrap_icon}"></i> ${el.text}</span>`;
        })
        divNER.append(results);

    }).catch(error => {
        console.error(error)
    });
};

// Trigger Sentiment Analysis
function getNormalizedScore(scoreArray) {
    let max_score = Math.max(...Object.values(scoreArray))
    let max_sentiment = Object.keys(scoreArray).filter(key => scoreArray[key]==max_score)[0];
    if (max_sentiment == "positive") return max_score;
    else if (max_sentiment == "negative") return max_score * -1;
    else return (scoreArray.positive >= scoreArray.negative) ? scoreArray.positive : scoreArray.negative * -1;
}

function getMaxSentiment(scoreArray) {
    let max_score = Math.max(...Object.values(scoreArray))
    let max_sentiment = Object.keys(scoreArray).filter(key => scoreArray[key]==max_score)[0];
    return {max_score, max_sentiment}
}

function runSentimentAnalysis(text, langCode) {    
    var payload = { 
        documents: [
            { id: "1", language: langCode, text: text}
        ]
    };

    axios({
        method: 'POST',
        url: `${azureAIEndpoint}/text/analytics/v3.2-preview.2/sentiment`,
        headers: {'Content-Type': 'application/json', 'Ocp-Apim-Subscription-Key': azureAIKey},
        data: payload,
        responseType: 'json',
    }).then(response => {
        max_score = getMaxSentiment(response.data.documents[0].confidenceScores).max_score;
        max_sentiment = getMaxSentiment(response.data.documents[0].confidenceScores).max_sentiment;
        normalized_score = getNormalizedScore( response.data.documents[0].confidenceScores);
        
        // Ppush label & sentiment score to chart for re-rendering
        var current_time = new Date();
        time_label = current_time.toLocaleString('en-US', { timeStyle: 'medium'});
        time_labels.push(time_label);
        score_values.push(normalized_score);
        addData(myChart, time_label, normalized_score);
        
        // Keep chart neatly at most recent 15 points
        if (score_values.length > 15) {
            shiftData(myChart);
        }
        
    }).catch(error => {
        console.error(error)
    });
};


// Chart.js
var time_labels = [];
var score_values = [];

// Gradient color (green: positive, yellow: neutral, red: negative)
function getGradient(ctx, chartArea, alpha) {
    let width, height, gradient;
    const chartWidth = chartArea.right - chartArea.left;
    const chartHeight = chartArea.bottom - chartArea.top;
    if (gradient === null || width !== chartWidth || height !== chartHeight) {
        // Create the gradient because this is either the first render
        // or the size of the chart has changed
        width = chartWidth;
        height = chartHeight;
        gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
        gradient.addColorStop(0, `rgb(255, 99, 132, ${alpha})`);
        gradient.addColorStop(0.3, `rgb(255, 205, 86, ${alpha})`);
        gradient.addColorStop(1, `rgb(75, 192, 192, ${alpha})`);
    }
    return gradient;
}

// Chart data (sentiment scores)
var data = {
    labels: [],
    datasets: [{
        label: 'Sentiment Score',
        data: [],
        borderWidth: 6,
        pointRadius: 3,
        fill: 'origin',
        backgroundColor: function(context) {
            const chart = context.chart;
            const {ctx, chartArea} = chart;
            if (!chartArea) {
                return null;
            }
            return getGradient(ctx, chartArea, .3);
        },
        // borderColor: '#333',
        borderColor: function(context) {
            const chart = context.chart;
            const {ctx, chartArea} = chart;
            if (!chartArea) {
                return null;
            }
            return getGradient(ctx, chartArea, 1);
        },
    }]
};

// Chart config & options
const config = {
    type: 'line',
    data: data,
    options: {
        elements: {
            line: {
                tension: 0.3
            },
        },
        plugins: {
            legend: {
                display: false
            }
        },
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: {
                display: true,
                title: {
                    display: false,
                    text: 'Sentiment Score',
                    color: '#eee',
                },
                ticks: {
                    color: '#eee'
                },
                suggestedMin: -1,
                suggestedMax: 1,
                grid: {
                    display: true,
                    borderWidth: 2,
                    borderDash: [3, 3],
                    color: '#eee',
                    borderDashOffset: 0,
                }
            },
            x: {
                ticks: {
                    color: '#eee',
                },
                grid: {
                    display: true,
                    borderWidth: 2,
                    borderDash: [3, 3],
                    color: '#eee',
                    borderDashOffset: 0,
                }
            } 
        }
    }
};

// Render chart
const myChart = new Chart($('#myChart'), config);

// Function for pushing & removing data
function addData(chart, label, data) {
    chart.data.labels.push(label);
    chart.data.datasets.forEach((dataset) => {
        dataset.data.push(data);
    });
    chart.update();
}

function shiftData(chart) {
    chart.data.labels.shift();
    chart.data.datasets.forEach((dataset) => {
        dataset.data.shift();
    });
    chart.update();
}
