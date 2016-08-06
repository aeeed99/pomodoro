// copy of sundial
function _SdGetDaysInCurrentYear(years, dateModel) {
    var febDays = years % 4 === 0 ? 29 : 28
    var dictionary = [31, febDays, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    var curMonth = dateModel.getMonth()
    var daysInFullMonths = dictionary.slice(0,curMonth).reduce(function(a,b){
        return a + b
    },0)
    return daysInFullMonths + dateModel.getDate() + 1
}

function _SdGetDaysInCurrentYear(years, dateModel) {
  var febDays = years % 4 === 0 ? 29 : 28
  var dictionary = [31, febDays, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  var curMonth = dateModel.getMonth()
  var daysInFullMonths = dictionary.slice(0, curMonth).reduce(function (a, b) {
    return a + b
  }, 0)
  return daysInFullMonths + dateModel.getDate() + 1
}

var Sd = function (date) {

  var dateModel = date ? new Date(date) : new Date()
  var years = dateModel.getFullYear() - 1970;
  var yearsInDays = years * 356 + (Math.floor((years - 2) / 4))

  var daysThisYear = _SdGetDaysInCurrentYear(years, dateModel)

  var sdDate = daysThisYear + yearsInDays

  this.jsDate = dateModel
  this.sdDate = sdDate
  this.daysThisyear = daysThisYear

  return sdDate

}
Sd.convertSd = function (sd) {
  if(sd.sdDate) sd = sd.sdDate;
  return new Date(sd * 86400000);
}




try {
  if (window) {
    window.Sd = Sd
  } else if (self) {
    self.Sd = Sd
  } else if (global) {
    global.Sd = Sd
  }
} catch (e) {
}
