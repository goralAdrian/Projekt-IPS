import React from 'react'
import {Route, Switch} from 'react-router-dom'
import Home from "./core/Home"
import Menu from "./core/Menu"
import Signup from "./user/Signup"
import Signin from "./user/Signin"
import Profile from "./user/Profile"
import toBuy from "./user/toBuy"

const MainRouter = () => (
  <div>
  <Menu />
  <Switch>
  <Route exact path = "/" component = {Home} />
  <Route exact path = "/signup" component = {Signup} />
  <Route exact path = "/signin" component = {Signin} />
  <Route exact path = "/profile" component = {Profile} />
  <Route exact path = "/toBuy" component = {toBuy} />
  </Switch>
  </div>
)

export default MainRouter;
