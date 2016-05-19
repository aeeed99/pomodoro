app.factory('Store', function ($http, $log) {

  //TODO: once users is implimented, the below defaultStore will only be retured if user is not logged in
  // this is the startng user state and will be modifed for as long as session is active. When a user signs up,
  // any progress from here will be passed to the user creation.

  let Store = {
    // user: null,
    // profile: {
    //   tomsEaten: {
    //     today: 0,
    //     tomatoMeter: []
    //     archive:[
    //       //{date: Date, total: 0, tomatoMeter: {<tomatoMeter>} }
    //     ],
    //     getTotal: function() {
    //       return Store.profile.tomsEaten.archive.map(t => t.total).reduce((p,n) => p + n, Store.profile.tomsEaten.today);
    //     }
    //   }
    // },
    // unlockedFeatures: [],
    features: [
      {name: "goalSetter", unlockAt: 1, listener: "tomComplete"},
      {name: "todo", unlockAt: 3, listener: "tomComplete"},
      {name: "markFail", unlockAt: {daysComplete: 2}, listener: "tomComplete" },
      {name: "snake", unlockAt: 8, type: "game", listener: "tomComplete"},
      {name: "playlist", unlockAt: {tomsToday: 8}, listener: "tomComplete" },
      {name: "goalSettor", unlockAt: {streak: 3}, listener: "tomComplete"},
      {name: "tetris", unlockAt: 44, type: "game", listener: "tomComplete"},
      {name: "darkTheme", unlockAt: {daysComplete: 30}, unlockFn: () => (new Date()).getHours() > 18, listener: "tomComplete"},
      {name: "1000tomsPage", unlockAt: 1000, listener: "tomComplete"},
    ],
    getTotalToms: function () {
      return Store.profile.tomsEaten.archive.map(t => t.total).reduce((p,n) => p + n, Store.profile.tomsEaten.today);
    },
    updateProfile: function (obj) {
      let newProfile = Object.assign({}, Store.profile, obj);
      console.log("new profile to update", newProfile);
      return $http.get('/session')
        .then(res => {
          return $http.put('/api/user/profile', {newProfile: newProfile, user: res.data.user})
        })
        .then(user => console.log("new user data", user))
        .catch(error => console.error("something went wrong", error));
    },
    archiveTomsEaten: function () {
      if (!Store.profile.tomsEaten.today) {
        $log.info("nothing to archive. User not updated");
        return;
      }
      let tomInfo = {
        date: new Date(),
        total: Store.profile.tomsEaten.today,
        tomatoMeter: Store.profile.tomsEaten.tomatoMeter.filter(t => t.text !== "..."),
      };
      Store.profile.tomsEaten.tomatoMeter = [];
      let newArchive = [tomInfo].concat(Store.profile.tomsEaten.archive);
      return Store.updateProfile({tomsEaten: {archive: newArchive} });
    },
  };

  return Store;

});

/*
  unlockAt:
    Number - amount of total toms eaten
    Obj - different prop to unlock at:
      tomsComplete (defualt) - total toms eaten. Same as passing number
      tomsToday - number in a day.
      daysComplete: number of days a tom was eaten: OR obj
      streak: number days in a row that a tom was eaten.

  Feature listeners:
    "tomComplete" : when a pomodoro is sucessfully complete.
    "newDay" : when the app is opened on a new day.
 */
