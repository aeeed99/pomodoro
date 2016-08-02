app.config(function ($stateProvider) {
  $stateProvider.state('home', {
    url: '/',
    templateUrl: 'js/home/home.html',
    controller: 'HomeCtrl',
    resolve: {
      user: function (AuthService, $rootScope, Store) {
        return AuthService.getLoggedInUser()
          .then(user => {
            console.log("USER STATUSSSS ", user);
            if (user) return user;
              console.log("no user, doing local profile");
            $rootScope.guestMode = true;
            var localProfile = localStorage.getItem("profile");
            if (localProfile) return JSON.parse(localProfile);
            console.info("no local profile, creating one!");

            var newLocalProfile = {
              email: "",
              tomsToday: 0,
              tomatoMeter: [],
              sunDial: Sd(),
              archive: [],
              unlockedFeatures: [],
              lastLoggedIn: Date.now(),
              name: "",
              guest: true,
            };
            localStorage.setItem("profile", JSON.stringify(newLocalProfile));
            return newLocalProfile;
          })
      },
      profile: function () {
        return { status: 100 }
      }
    }
  });
});

app.controller('HomeCtrl', function ($scope, Store, profile, user, ProfileUpdater) {
  console.log("the user: ", user);

  if (profile.status === 202) {
    Store.archiveTomsEaten();
  }

  $scope.updateController = function () {
    return AuthService.getLoggedInUser()
      .then(newUser => {
        user = newUser;
        $scope.$digest();
      })
  };
  $scope.$on('update-controller', function (event, newUser, error) {
    if (error) {
      console.log("an error happened!!!!!", newUser);
      return;
    }
    console.info("[HomeCtrl] `update-controller` triggered", newUser);
    user = newUser;
    $scope.tomatoMeter = user.tomatoMeter.concat({class: 'wait', text: "..."});
    activeIdx = $scope.tomatoMeter.length - 1;
    completed = user.tomsToday || 0;
    // $scope.$digest();
    // $scope.updateController();
  });

  // assign current stats to pick up where we left off.
  $scope.isGuest = user.isGuest;
  $scope.tomatoMeter = user.tomatoMeter.concat({class: 'wait', text: "..."});
  let completed = user.tomsToday || 0;

  // stuff that has a lifecycle
  $scope.state = {
    timerRunning: false,
    timerPaused: false,
    onBreak: false,
    editing: false
  };
  let state = $scope.state; // for better readability.
  var timer;
  let titleCache;

  let getGoal = () => $scope.goal || "eating a tomato";

  $scope.getCompleted = () => completed;
  $scope.getTotal = function(){
    return Store.getTotalToms(user);
  }

  // $scope.goal = "";


  $scope.time = "0:00";
  // $scope.state.onBreak = () => $scope.state.onBreak;
  let activeIdx = ($scope.tomatoMeter.length - 1) || 0;

  $scope.startTimer = function (time = [25, 0]) {
    let activeTom = $scope.tomatoMeter[activeIdx];
    activeTom.class = 'active';
    activeTom.text = completed + 1;
    state.timerRunning = true;

    let intervalFn = function () {
      // assign scope and document title in one go
      document.title = "[" + ($scope.time = timer.getMins() + ":" + timer.getSecs()) + "] « " + getGoal();
      $scope.$digest();
      //console.info("interval");
    };

    let completeFn = function () {
      if (document.hidden) new Notification("Pomodoro complete", {
        body: "Take a 5 minute break or select other options",
        icon: "/public/tomato.png"
      });
      $scope._markComplete();
      $scope.$digest();
    };

    timer = new Timer(time, completeFn, intervalFn);
    document.title = "[" + ($scope.time = "25:00") + "] « " + getGoal();
  };
  $scope.togglePause = function () {
    if (!timer)  return;

    timer.togglePause();
    state.timerPaused = !state.timerPaused;
    if (!titleCache) {
      titleCache = document.title;
      document.title = "▐▐ " + document.title;
    }
    else {
      document.title = titleCache;
      titleCache = null;
    }

  };


  //// INTERNAL LOGIC ///
  // TODO this stuff should be moved off the scope and put into apropriate timeouts.

  $scope._markComplete = function () {
    let activeTom = $scope.tomatoMeter[activeIdx];
    // mark the pending tom complete
    activeTom.text = completed + 1; //for human readble 1-indexing
    activeTom.class = 'complete';

    completed++;
    activeIdx++;
    // $scope.tomatoMeter.push({class: 'wait', text: '...'})

    ProfileUpdater.pushTomatoMeter(activeTom);
    // .then(res => console.info("[home.js:markCoplete] user profile updated", res));
    // Store.profile.tomsEaten.today++;
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
    ProfileUpdater.pushTomatoMeter(activeTom);
  };
  $scope._markFailed = function () {
    let activeTom = $scope.tomatoMeter[activeIdx];
    activeIdx++;
    activeTom.class = 'fail';
    activeTom.text = 'X';
    ProfileUpdater.pushTomatoMeter(activeTom);
    // $scope.tomatoMeter.push({class: 'wait', text: '...'});
    // Store.updateProfile({
    //     tomsEaten: {
    //         tomatoMeter: $scope.tomatoMeter,
    //     }
    // })
  };

  $scope.deleteTomatoMeter = ProfileUpdater.deleteTomatoMeter;
  $scope.archiveTomatoMeter = ProfileUpdater.archiveTomatoMeter;


  let $inputGoal = $('input.goal'),
    $placeholder = $('#placeholder'),
    $goalInput = $('#goalInput');

  $scope.toggleEdit = () => {
    $placeholder.hide();
    $goalInput.show();
    setTimeout(() => document.getElementById('goalInput').focus(), 0);
  };
  $goalInput.blur(() => {
    if (!$scope.goal) {
      $goalInput.hide();
      $placeholder.show();
    }
  });
  $goalInput.keypress(e => {
    if (e.keyCode === 13) {
      console.log("finish edit");
      $inputGoal.blur();
    }
  });


  //tomato button controls
});
