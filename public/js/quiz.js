// public/js/quiz.js
// ------------------------------------------------------------
// Final quiz controller for the Reze Blox YT Quiz.
// - Reads window.QUIZ_QUESTIONS on DOMContentLoaded
// - Renders one question at a time
// - Tracks answers in memory only
// - Submits normal attempts to /quiz/submit
// - Instantly locks cheating attempts on tab/window switch
// ------------------------------------------------------------

(() => {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    const questions = Array.isArray(window.QUIZ_QUESTIONS) ? window.QUIZ_QUESTIONS : [];

    const elements = {
      questionArea: document.querySelector('#quizQuestionArea'),
      questionCounter: document.querySelector('#questionCounter'),
      answeredCounter: document.querySelector('#answeredCounter'),
      progressFill: document.querySelector('#progressFill'),
      quizMessage: document.querySelector('#quizMessage'),
      prevBtn: document.querySelector('#prevBtn'),
      nextBtn: document.querySelector('#nextBtn'),
      submitBtn: document.querySelector('#submitQuizBtn'),
      cheatOverlay: document.querySelector('#cheatOverlay'),
      cheatCountdown: document.querySelector('#cheatCountdown')
    };

    if (!elements.questionArea || !elements.questionCounter || !elements.progressFill) {
      console.error('Quiz page is missing required HTML elements.');
      return;
    }

    if (!questions.length) {
      elements.questionArea.innerHTML = `
        <div class="notice compact error-notice">
          The quiz questions could not be loaded. Please refresh the page or contact the server team.
        </div>
      `;
      return;
    }

    let currentQuestionIndex = 0;
    let quizActive = true;
    let normalSubmitInProgress = false;
    let cheatTriggered = false;
    let redirectTimerStarted = false;
    const selectedAnswers = new Array(questions.length).fill(null);

    attachQuizEvents();
    attachCheatDetection();
    renderQuestion();

    function attachQuizEvents() {
      elements.prevBtn?.addEventListener('click', () => {
        if (currentQuestionIndex > 0 && !normalSubmitInProgress && !cheatTriggered) {
          currentQuestionIndex -= 1;
          renderQuestion();
        }
      });

      elements.nextBtn?.addEventListener('click', () => {
        if (normalSubmitInProgress || cheatTriggered) return;

        if (!currentQuestionHasAnswer()) {
          showMessage('Please select an answer before moving to the next question.');
          return;
        }

        if (currentQuestionIndex < questions.length - 1) {
          currentQuestionIndex += 1;
          renderQuestion();
        }
      });

      elements.submitBtn?.addEventListener('click', () => {
        if (normalSubmitInProgress || cheatTriggered) return;

        if (!currentQuestionHasAnswer()) {
          showMessage('Please select an answer before submitting.');
          return;
        }

        const unansweredIndex = selectedAnswers.findIndex((answer) => answer === null);

        if (unansweredIndex !== -1) {
          currentQuestionIndex = unansweredIndex;
          renderQuestion();
          showMessage('Please answer every question before final submission.');
          return;
        }

        submitQuizAnswers();
      });
    }

    function attachCheatDetection() {
      // These listeners exist only on the quiz page because this file only loads from views/quiz.ejs.
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          triggerCheatLock('visibilitychange');
        }
      });

      window.addEventListener('blur', () => {
        triggerCheatLock('window.blur');
      });

      window.addEventListener('beforeunload', () => {
        if (quizActive && !normalSubmitInProgress && !cheatTriggered) {
          sendCheatRequest(true);
        }
      });
    }

    function renderQuestion() {
      const question = questions[currentQuestionIndex];

      if (!question || !Array.isArray(question.choices) || question.choices.length !== 4) {
        elements.questionArea.innerHTML = `
          <div class="notice compact error-notice">
            This question could not be rendered. Please refresh the page.
          </div>
        `;
        console.error('Invalid question data:', question);
        return;
      }

      clearMessage();

      const selectedChoiceIndex = selectedAnswers[currentQuestionIndex];
      const optionsHtml = question.choices
        .map((choice, choiceIndex) => {
          const isSelected = selectedChoiceIndex === choiceIndex;
          return `
            <button
              class="option-btn ${isSelected ? 'selected' : ''}"
              type="button"
              role="radio"
              aria-checked="${isSelected ? 'true' : 'false'}"
              data-choice-index="${choiceIndex}"
            >
              <strong>${String.fromCharCode(65 + choiceIndex)}.</strong> ${escapeHtml(choice)}
            </button>
          `;
        })
        .join('');

      elements.questionArea.innerHTML = `
        <h2 class="question-title">${escapeHtml(question.text)}</h2>
        <div class="options-grid" role="radiogroup" aria-label="Answer choices for question ${currentQuestionIndex + 1}">
          ${optionsHtml}
        </div>
      `;

      elements.questionArea.querySelectorAll('.option-btn').forEach((button) => {
        button.addEventListener('click', () => {
          if (normalSubmitInProgress || cheatTriggered) return;
          selectedAnswers[currentQuestionIndex] = Number(button.dataset.choiceIndex);
          renderQuestion();
        });
      });

      updateControls();
    }

    function updateControls() {
      const totalQuestions = questions.length;
      const answeredCount = selectedAnswers.filter((answer) => answer !== null).length;
      const progressPercent = ((currentQuestionIndex + 1) / totalQuestions) * 100;
      const isLastQuestion = currentQuestionIndex === totalQuestions - 1;

      elements.questionCounter.textContent = `Question ${currentQuestionIndex + 1} / ${totalQuestions}`;

      if (elements.answeredCounter) {
        elements.answeredCounter.textContent = `${answeredCount} answered`;
      }

      elements.progressFill.style.width = `${progressPercent}%`;

      if (elements.prevBtn) {
        elements.prevBtn.disabled = currentQuestionIndex === 0 || normalSubmitInProgress || cheatTriggered;
      }

      if (elements.nextBtn) {
        elements.nextBtn.classList.toggle('hidden', isLastQuestion);
        elements.nextBtn.disabled = normalSubmitInProgress || cheatTriggered;
      }

      if (elements.submitBtn) {
        elements.submitBtn.classList.toggle('hidden', !isLastQuestion);
        elements.submitBtn.disabled = normalSubmitInProgress || cheatTriggered;
      }
    }

    function currentQuestionHasAnswer() {
      return selectedAnswers[currentQuestionIndex] !== null;
    }

    async function submitQuizAnswers() {
      try {
        quizActive = false;
        normalSubmitInProgress = true;
        updateControls();
        showMessage('Submitting your answers...');

        const response = await fetch('/quiz/submit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ answers: selectedAnswers })
        });

        const result = await safeJson(response);

        if (!response.ok || !result.success) {
          quizActive = true;
          normalSubmitInProgress = false;
          updateControls();
          showMessage(result.message || 'Submission failed. Please try again.');
          return;
        }

        window.location.href = result.redirectTo || '/credits';
      } catch (error) {
        quizActive = true;
        normalSubmitInProgress = false;
        updateControls();
        console.error('Quiz submit failed:', error);
        showMessage('Network error. Please check your connection and try again.');
      }
    }

    function triggerCheatLock(reason) {
      if (!quizActive || normalSubmitInProgress || cheatTriggered) return;

      cheatTriggered = true;
      quizActive = false;
      normalSubmitInProgress = true;

      showCheatOverlay();
      updateControls();
      sendCheatRequest(false, reason);
      startCheatRedirectCountdown();
    }

    function sendCheatRequest(useBeacon, reason = 'page-unload') {
      const payload = JSON.stringify({
        answers: selectedAnswers.filter((answer) => answer !== null),
        reason
      });

      if (useBeacon && navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon('/quiz/cheated', blob);
        return Promise.resolve();
      }

      return fetch('/quiz/cheated', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: payload,
        keepalive: true
      }).catch((error) => {
        console.error('Cheat lock request failed:', error);
      });
    }

    function showCheatOverlay() {
      if (!elements.cheatOverlay) return;
      elements.cheatOverlay.classList.remove('hidden');
      document.body.classList.add('no-scroll');
    }

    function startCheatRedirectCountdown() {
      if (redirectTimerStarted) return;
      redirectTimerStarted = true;

      let secondsLeft = 3;
      updateCountdown(secondsLeft);

      const interval = window.setInterval(() => {
        secondsLeft -= 1;
        updateCountdown(secondsLeft);

        if (secondsLeft <= 0) {
          window.clearInterval(interval);
          window.location.href = '/credits';
        }
      }, 1000);
    }

    function updateCountdown(secondsLeft) {
      if (elements.cheatCountdown) {
        elements.cheatCountdown.textContent = String(Math.max(secondsLeft, 0));
      }
    }

    function showMessage(message) {
      if (elements.quizMessage) {
        elements.quizMessage.textContent = message;
      }
    }

    function clearMessage() {
      showMessage('');
    }
  });

  async function safeJson(response) {
    try {
      return await response.json();
    } catch (error) {
      return {};
    }
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }
})();
