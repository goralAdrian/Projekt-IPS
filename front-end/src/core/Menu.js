import React from "react";
import { Link, withRouter } from "react-router-dom";

const isActive = (history, path) => {
    if (history.location.pathname === path) return { color: "black" };
    else return { color: "white" };
};

const isAuthenticated = () => {
    if (typeof window == "undefined") {
        return false;
    }
    if (localStorage.getItem("jwt")) {
        return JSON.parse(localStorage.getItem("jwt"));
    } else {
        return false;
    }
};

const signout = next => {
    if (typeof window !== "undefined") localStorage.removeItem("jwt");
    next();
    return fetch("http://localhost:8080/signout", {
        method: "GET"
    })
        .then(response => {
            console.log("signout", response);
            return response.json();
        })
        .catch(err => console.log(err));
};

const Menu = ({ history }) => (
    <div>
        <ul className="nav nav-tabs bg-dark">
            <li className="nav-item">
                <Link
                    className="nav-link"
                    style={isActive(history, "/")}
                    to="/"
                >
                    Strona główna
                </Link>
            </li>
            {!isAuthenticated() && (
               <>
                   <li className="nav-item">
                       <Link
                           className="nav-link"
                           style={isActive(history, "/signin")}
                           to="/signin"
                       >
                           Logowanie
                       </Link>
                   </li>
                   <li className="nav-item">
                       <Link
                           className="nav-link"
                           style={isActive(history, "/signup")}
                           to="/signup"
                       >
                           Rejestracja
                       </Link>
                   </li>
               </>
           )}

           {isAuthenticated() && (
               <>
                   <li className="nav-item">
                       <a
                           className="nav-link"
                           style={
                               (isActive(history, "/signup"),
                               { cursor: "pointer", color: "black" })
                           }
                           onClick={() => signout(() => history.push("/"))}
                       >
                           Wyloguj
                       </a>
                   </li>
                   <li className="nav-item">
                   <Link
                       className="nav-link"
                       style={isActive(history, "/signup")}
                       to="/profile"
                   >
                       Profil użytkownika
                   </Link>
                   </li>
               </>
           )}
       </ul>
   </div>
);

export default withRouter(Menu);
