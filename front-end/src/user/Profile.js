import React, { Component } from "react";
import { Redirect } from "react-router-dom";
import { isAuthenticated } from "../auth"

class Profile extends Component {
    constructor() {
        super();
        this.state = {
            user: "",
            redirectToSignin: false
        };
    }

    componentDidMount() {
        const userId = this.props.match.params.userId;
        fetch(`http://localhost:8080/user/:${userId}`, {
            method: "GET",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                Authorization: `Bearer ${isAuthenticated().token}`
            }
        })
            //.then(response => {
                //return response.json();
          // })
            .then(data => {
                if (data.error) {
                    this.setState({ redirectToSignin: true });
                } else {
                    this.setState({ user: data });
                }
            });
    }

    render() {
        const redirectToSignin = this.state.redirectToSignin;
        if (redirectToSignin) return <Redirect to="/signin" />;

        return (
            <div className="container">
                <h2>Profil użytkownika</h2>
                <p>Nazwa użytkownika: {isAuthenticated().user.name}</p>
                <p>Email: {isAuthenticated().user.email}</p>
                <p>{`Dołączono: ${new Date(
                    this.state.user.created
                ).toDateString()}`}</p>
				<p>Wypożyczono książek: </p>
            </div>
        );
    }
}

export default Profile;