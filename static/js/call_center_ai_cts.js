/*
Copyright (C) Jixin Jia (Gin)
Created for Microsoft GBB AI Solutions Demo Portal
Component:  Contact Center AI Demo js component
Author:     Jixin Jia (Gin)
*/

var gpt_loading_spinner = '<div id="openai_spinner" class="h-center"><div class="spinner-border text-success mb-2 loading-icon" role="status"></div><p class="mute text-s">Summarizing...</p></div>'

// Speech Recognition & Translation with Speech SDK
var SpeechSDK;
var recognizer;
var startAsyncButton = $("#startAsyncButton");
var stopAsyncButton = $("#stopAsyncButton");
var azureAIKey = $("#azureAIKey").val();
var azureAIRegion = $("#azureAIRegion").val();
var speechLang = $('select#speechLang').val();
var azureAIEndpoint = $("#azureAIEndpoint").val();
var translateLang = $('select#translateLang').val();
var displaySpeech = $("#displaySpeech");
var displayTranslation = $("#displayTranslation");
var divRecognized = $('#divRecognized');
var divTranslated = $('#divTranslated');
var aoaiKey = $("#aoaiKey").val();
var aoaiEndpoint = $("#aoaiEndpoint").val();
var gptModel = $("#gptModel").val();
var divNER = $('#divNER');
var divOpenAICard = $('#divOpenAICard');
var divOpenAI = $('#divOpenAI');
var divOpenAISpinner = $('#divOepnAISpinner');
var speakerId = 'Unknown';

// Update parameter selection
$("select#speechLang").change(function() {
    speechLang = $(this).children("option:selected").val();
});
$("select#translateLang").change(function() {
    translateLang = $(this).children("option:selected").val();
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
$("#aoaiKey").change(function() {
    aoaiKey = $(this).val();
});
$("#aoaiEndpoint").change(function() {
    aoaiEndpoint = $(this).val();
});
$("#gptModel").change(function() {
    gptModel = $(this).val();
});


// On DOM ready load SpeechSDK and start MediaRecorder
$(document).ready(function() {  
    
    // Show pre-loading page
    // var random_queue_time = Math.floor(Math.random() * (3000 - 1000 + 1)) + 1000;
    var random_queue_time = 0;
    
    setTimeout(function(){
        if (!!window.SpeechSDK) {
            SpeechSDK = window.SpeechSDK;
            startAsyncButton.disabled = false;
            $('#warning').hide();
            $('#demo-container').show();
        }
    },random_queue_time);
    
    // Speech-to-text and Speech Translation from audio stream
    startAsyncButton.on("click", function(event) {
        
        // Fetch forms and check input validation (Speech/Language Key) 
        var forms = document.querySelectorAll('.needs-validation');
        Array.prototype.slice.call(forms).forEach(function (form) {

            if (!form.checkValidity()) {
                event.preventDefault()
                event.stopPropagation()
            }
            form.classList.add('was-validated')
        })

        // Check validity
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
            
            // Speech config
            const speechConfig = SpeechSDK.SpeechTranslationConfig.fromSubscription(azureAIKey, azureAIRegion);
            
            // Set properties
            speechConfig.speechRecognitionLanguage = speechLang;
            speechConfig.addTargetLanguage(translateLang);
            speechConfig.setProperty("f0f5debc-f8c9-4892-ac4b-90a7ab359fd2", "true");
            speechConfig.setProperty("ConversationTranscriptionInRoomAndOnline", "true");
            speechConfig.setProperty("DifferentiateGuestSpeakers", "true");
            speechConfig.setProperty("TranscriptionService_SingleChannel", "true");
            speechConfig.outputFormat = SpeechSDK.OutputFormat.Simple;

            // Audio config
            const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
            
            // Initialize transcriber (for Speaker ID)
            transcriber = new SpeechSDK.ConversationTranscriber(speechConfig, audioConfig);
            transcriber.startTranscribingAsync(() => {console.log("Transcriber session started successfully");});

            // Initialize recognizer (for Recognition & Translation)
            recognizer = new SpeechSDK.TranslationRecognizer(speechConfig, audioConfig);
            recognizer.startContinuousRecognitionAsync(console.log('Recognizer session started successfully'));
            

            // (1) Event Recognizing
            recognizer.recognizing = (s, e) => {
                var current_time = new Date();
                time_label = current_time.toLocaleString('en-US', { timeStyle: 'medium', hour12: false});
                
                // Update display window with in-progress recognition & translation
                displaySpeech.html(divRecognized.val() + '['+ time_label +'] ' +e.result.text);
                displayTranslation.html(divTranslated.val() + '['+ time_label +'] ' + e.result.translations.get(translateLang));
            };

            // (2) Event Transcribed - Speaker ID and Transcribed texts
            transcriber.transcribed = function (s, e) {
                // console.log('Transcribed texts: '+ e.result.text +'\nReason: '+ e.result.reason +'\nRaw Speaker ID: '+ e.result.speakerId);

                var current_time = new Date();
                time_label = current_time.toLocaleString('en-US', { timeStyle: 'medium', hour12: false});
                
                // append newly recognized phrase to the recognized list
                // check if e.result.text length is > 1
                if (e.result.text.length) {
                    speakerId = e.result.speakerId;
                    divRecognized.append('['+ speakerId +'] '+e.result.text+'\n');
                    displaySpeech.html(divRecognized.val());
                }
            }

            // (3) Event Recognized - Translated texts
            recognizer.recognized = (s, e) => {
                if (e.result.reason == SpeechSDK.ResultReason.RecognizedSpeech || e.result.reason == SpeechSDK.ResultReason.TranslatedSpeech) {
                    var current_time = new Date();
                    time_label = current_time.toLocaleString('en-US', { timeStyle: 'medium', hour12: false});

                    if (e.result.text) {
                        langCode = speechLang.substring(0, speechLang.indexOf('-'));
                        runSentimentAnalysis(e.result.text, langCode);
                        // runNER(e.result.text, langCode);
                    }
                    
                    // append newly translated phrase to the translated list
                    if (e.result.translations.get(translateLang)) {
                        divTranslated.append('['+ speakerId +'] '+e.result.translations.get(translateLang)+'\n');
                        displayTranslation.html(divTranslated.val());
                    }
                }
            };

            // (4) Recognizer exception handlers
            recognizer.canceled = (s, e) => {
                console.log(`Recognizer CANCELED: Reason=${e.reason}`);
                if (e.reason == sdk.CancellationReason.Error) {
                    console.log(`"Recognizer CANCELED: ErrorCode=${e.errorCode}`);
                    console.log(`"Recognizer CANCELED: ErrorDetails=${e.errorDetails}`);
                    console.log("Recognizer CANCELED: Did you set the speech resource key and region values?");
                }
                recognizer.stopContinuousRecognitionAsync();
            };

            recognizer.sessionStopped = (s, e) => {
                console.log("Recognizer session stopped");
                recognizer.stopContinuousRecognitionAsync();
            };
             
            
            // Stop Aysnc Button
            stopAsyncButton.on("click", function () {
                recognizer.stopContinuousRecognitionAsync();
                transcriber.stopTranscribingAsync(
                    () => {
                      transcriber.close();
                      transcriber = undefined;
                    }
                );
                startAsyncButton.show();
                stopAsyncButton.hide();
                runGPT();
            });
        }
    });
});


// Trigger OpenAI
function runGPT() {
    if ($("#displaySpeech").val().length==0) {
        return;
    }
    var form_data = JSON.stringify({
        transcription: $("#displaySpeech").val(),
        aoaiKey: aoaiKey,
        aoaiEndpoint: aoaiEndpoint,
        gptModel: gptModel
      });
      $.ajax({
        url: $SCRIPT_ROOT + '/gpt',
        type: 'POST',
        contentType: 'application/json;charset=UTF-8',
        data: form_data,
        dataType: 'json',
        beforeSend: function() {
            divOpenAI.html(gpt_loading_spinner);
            divOpenAICard.addClass('v-center');
        }
      }).done(function(response) {
        divOpenAICard.removeClass('v-center');
        if (response.status == 'OK') {
            var entities = response.q3;
            var arrayLength = entities.length;
            var entityHTML = '';
            for (var i = 0; i < arrayLength; i++) {
                entityHTML += `<span class="badge badge-success rounded-pill text-light px-3 mb-1 me-1 text-s lh-base">${entities[i]}</span>`;
            }
            divOpenAI.html(`
            <div class="h5 pb-1 text-gray-800 text-m lh-base fw-light" style="text-align: start;">
                <h6>Summary</h6>
                <p class="mute text-m">${response.q1}</p>
                <h6>Overall Sentiment (0-100)</h6>
                <p>${response.q2}</p>
                <h6>Key Entities</h6>
                <p>${entityHTML}</p>
                <h6>Topic</h6>
                <p>${response.q4}</p>
            </div>
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

// Text Analytics SentimentAnalysis
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
            },
            title: {
                display: true,
                text: 'Realtime Speech Sentiment'
            },
        },
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: {
                display: true,
                title: {
                    display: false,
                    text: 'Sentiment Score'
                },
                suggestedMin: -1,
                suggestedMax: 1,
                grid: {
                    display: true,
                    borderWidth: 2,
                    borderDash: [3, 3],
                    color: '#aaa',
                    borderDashOffset: 0,
                }
            },
            x: {
                grid: {
                    display: true,
                    borderWidth: 2,
                    borderDash: [3, 3],
                    color: '#aaa',
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
