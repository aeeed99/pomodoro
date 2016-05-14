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
  $scope.onBreak = false;
  var timer;

  $scope.getCompleted = () => completed;
  $scope.getTotal = Store.profile.tomsEaten.getTotal;


  $scope.time = "0:00";
  // $scope.onBreak = () => $scope.onBreak;
  $scope.tomatoMeter = [
    {class: 'wait', text: "..."},
  ];

  $scope.startTimer = function () {
    let activeTom = $scope.tomatoMeter[activeIdx];
    activeTom.class = 'active';
    activeTom.text = completed + 1;

    let intervalFn = function() {
      // assign scope and document title in one go
      document.title = "[" + ($scope.time = timer.getMins() + ":" + timer.getSecs()) + "] « eating a tomato";
      $scope.$digest();
      console.log("aue")
    };
    let completeFn = function () {
      new Notification("Pomodoro complete", { body: "Take a 5 minute break or select other options"});
    };
    timer = new Timer([0,3], completeFn, intervalFn);
    document.title = "[" + ($scope.time = "25:00") + "] «  eating a tomato";
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
    $scope.onBreak = true;
  };
  $scope._markBreakComplete = function () {
    let activeTom = $scope.tomatoMeter[activeIdx];
    activeIdx++;
    activeTom.class = "break complete";
    $scope.tomatoMeter.push({class: 'wait', text: '...'});
    $scope.onBreak = false;
  };
  $scope._markFailed = function () {
    let activeTom = $scope.tomatoMeter[activeIdx];
    activeIdx++;
    activeTom.class = 'fail';
    activeTom.text = 'X';
    $scope.tomatoMeter.push({class: 'wait', text: '...'});
  }
});
