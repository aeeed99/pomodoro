app.config(function ($stateProvider) {
    $stateProvider.state('home', {
        url: '/',
        templateUrl: 'js/home/home.html',
        controller: 'HomeCtrl'
    });
});

app.controller('HomeCtrl', function ($scope, Store) {

  let completed = 0;
  let activeIdx = 0;
  $scope.state = {
    timerRunning: false,
    timerPaused: false,
    onBreak: false,
    editing: false
  };
  let state = $scope.state; // for better readability.
  var timer;
  let titleCache;

  $scope.getCompleted = () => completed;
  $scope.getTotal = Store.profile.tomsEaten.getTotal;

  $scope.goal = "";


  $scope.time = "0:00";
  // $scope.state.onBreak = () => $scope.state.onBreak;
  $scope.tomatoMeter = [
    {class: 'wait', text: "..."},
  ];

  $scope.startTimer = function (time=[25,0]) {
    let activeTom = $scope.tomatoMeter[activeIdx];
    activeTom.class = 'active';
    activeTom.text = completed + 1;
    state.timerRunning = true;

    let intervalFn = function() {
      // assign scope and document title in one go
      document.title = "[" + ($scope.time = timer.getMins() + ":" + timer.getSecs()) + "] « eating a tomato";
      $scope.$digest();
      console.info("interval");
    };

    let completeFn = function () {
      if(document.hidden) new Notification("Pomodoro complete", { body: "Take a 5 minute break or select other options", icon: "/public/tomato.png"});
      $scope._markComplete();
      $scope.$digest();
    };
    timer = new Timer(time, completeFn, intervalFn);
    document.title = "[" + ($scope.time = "25:00") + "] «  eating a tomato";
  };
  $scope.togglePause = function () {
    if(!timer)  return;

    timer.togglePause();
    state.timerPaused = !state.timerPaused;
    if(!titleCache){
      titleCache = document.title;
      document.title = "▐▐ " + document.title;
    }
    else {
      document.title = titleCache;
      titleCache = null;
    }

  };

  $scope._markComplete = function() {
    let activeTom = $scope.tomatoMeter[activeIdx];
    activeTom.text = completed + 1;
    activeTom.class = 'complete';
    completed++;
    activeIdx++;
    Store.profile.tomsEaten.today++;
    $scope.tomatoMeter.push({class: 'wait', text: '...'})
  };

  $scope._markBreakStart = function () {
    let activeTom = $scope.tomatoMeter[activeIdx];
    activeTom.text = "#break#";
    activeTom.class = 'break';
    $scope.state.onBreak = true;
  };
  $scope._markBreakComplete = function () {
    let activeTom = $scope.tomatoMeter[activeIdx];
    activeIdx++;
    activeTom.class = "break complete";
    $scope.tomatoMeter.push({class: 'wait', text: '...'});
    $scope.state.onBreak = false;
  };
  $scope._markFailed = function () {
    let activeTom = $scope.tomatoMeter[activeIdx];
    activeIdx++;
    activeTom.class = 'fail';
    activeTom.text = 'X';
    $scope.tomatoMeter.push({class: 'wait', text: '...'});
  };

  let $inputGoal = $('input.goal'),
    $placeholder = $('#placeholder'),
    $goalInput = $('#goalInput');

  $scope.toggleEdit = () => {
    $placeholder.hide();
    $goalInput.show();
    setTimeout(() => document.getElementById('goalInput').focus(), 0);
  };
  $goalInput.blur(() => {
    if(!$scope.goal) {
      $goalInput.hide();
      $placeholder.show();
    }
  });
  $('body').on('click', () => {
    console.log("scope gal", !!$scope.goal, $scope.goal);
    if(!$scope.goal) {
      // re put up the placeholder
      state.editing = false;
      // $placeholder.show();
    }
  });
  $(document).keypress(e => {
    if(e.keyCode === 13 && state.editing) {
      console.log("finish edit");
      $inputGoal.blur();
      $scope.toggleEdit();
    }
  });


  //tomato button controls
});
