// ********************** Initialize server **********************************

const server = require("../src/index"); //TODO: Make sure the path to your index.js is correctly added

// ********************** Import Libraries ***********************************

const chai = require("chai"); // Chai HTTP provides an interface for live integration testing of the API's.
const chaiHttp = require("chai-http");
chai.should();
chai.use(chaiHttp);
const { assert, expect } = chai;

// ********************** DEFAULT WELCOME TESTCASE ****************************

describe("Server!", () => {
  // Sample test case given to test / endpoint.
  it("Returns the default welcome message", (done) => {
    chai
      .request(server)
      .get("/welcome")
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.status).to.equals("success");
        assert.strictEqual(res.body.message, "Welcome!");
        done();
      });
  });
});

// *********************** TODO: WRITE 2 UNIT TESTCASES **************************

describe("Testing Register API", () => {
  
  // Positive Test Case
  // This test verifies that a user can successfully register with valid input
  it("Positive : /register - should register a new user with valid credentials", (done) => {
    chai
      .request(server)
      .post("/register")
      .send({
        username: "testuser" + Date.now(), // Unique username to avoid conflicts
        password: "securePassword123",
        firstName: "Test",
        lastName: "User",
        email: "test" + Date.now() + "@example.com", // Unique email
        dateOfBirth: "2000-01-01"
      })
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res).to.be.html; // Your API renders an HTML page
        expect(res.text).to.include("User registered successfully!");
        done();
      });
  });

  // Negative Test Case
  // This test verifies that registration fails when username is an invalid type (number instead of string)
  // Negative Test Case
// This test verifies that registration fails with duplicate username
it("Negative : /register - should reject registration with duplicate username", (done) => {
  const testUser = {
    username: "duplicatetest",
    password: "password123",
    firstName: "Test",
    lastName: "User",
    email: "unique" + Date.now() + "@example.com",
    dateOfBirth: "2000-01-01"
  };
  
  // First registration - should succeed
  chai
    .request(server)
    .post("/register")
    .send(testUser)
    .end(() => {
      // Second registration with same username - should fail
      chai
        .request(server)
        .post("/register")
        .send({
          username: "duplicatetest", // Same username
          password: "differentpass",
          firstName: "Other",
          lastName: "User",
          email: "different" + Date.now() + "@example.com",
          dateOfBirth: "1990-01-01"
        })
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res).to.be.html;
          expect(res.text).to.include("Registration failed");
          expect(res.text).to.include("already exist");
          done();
        });
    });
});
});

// *******************************************************************************
//EXTRA CREDIT- 2 more test cases 

//TEST CASE #3- NEGATIVE TEST CASE FOR password length too short

it("Negative : /register - should fail for a short password", (done) => {
  chai
    .request(server)
    .post("/register")
    .send({
      username: "shortpass" + Date.now(),
      password: "123", // too short
      firstName: "Test",
      lastName: "User",
      email: "shortpass" + Date.now() + "@example.com",
      dateOfBirth: "2000-01-01"
    })
    .end((err, res) => {
      expect(res).to.have.status(200);
      expect(res).to.be.html;
      expect(res.text).to.include("Registration failed");
      expect(res.text).to.include("password");
      done();
    });
});

//TEST CASE #4(EXTRA CREDIT)- POSITIVE TEST CASE FOR USERNAME WITH SPECIAL CHARACTERS
//verifies that a user can successfully register with special characters in their name
it("Positive : /register - should allow valid special characters", (done) => {
  chai
    .request(server)
    .post("/register")
    .send({
      username: "special" + Date.now(),
      password: "password123",
      firstName: "Anne-Marie",
      lastName: "O'Neil",
      email: "special" + Date.now() + "@example.com",
      dateOfBirth: "1995-05-05"
    })
    .end((err, res) => {
      expect(res).to.have.status(200);
      expect(res.text).to.include("User registered successfully!");
      done();
    });
});

