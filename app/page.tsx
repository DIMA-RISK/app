import Countdown from './components/Countdown';

export default function Home() {
  return (
    <section className="bg-white hero p-0">
      <div className="container-fluid">
        <div className="row">

          {/* LEFT SIDE */}
          <div className="col-sm-5 bg-light text-center p-5 d-flex flex-column justify-content-center">
            <h1 className="pt-4 h2">
              <span style={{ color: "#28a745" }}>DIMA.</span>
            </h1>
            <h3>AI Risk Intelligence Platform</h3>

            <p className="mt-4">
              We build intelligent AI systems <br />
              for anomaly detection & enterprise risk.
            </p>

            <div className="mt-4 fw-bold">
              We're launching soon.
            </div>

            {/* Countdown Component */}
            <Countdown />
          </div>

          {/* RIGHT SIDE */}
          <div className="col-sm-7 px-5 py-5">

            {/* ABOUT */}
            <section className="pt-4">
              <div className="container-fluid">
                <div className="row">
                  <div className="col-sm-8 mx-auto text-center">
                    <h2 className="text-primary pb-3">About Us</h2>
                    <p className="text-muted">
                      DIMA Risk is an AI-powered intelligence platform
                      built to detect anomalies, categorize risk patterns,
                      and provide enterprise-level insights in real time.
                    </p>
                  </div>
                </div>

                <div className="row d-md-flex mt-4 text-center">
                  <div className="col-sm-4 mt-3">
                    <h4>AI Detection</h4>
                    <p className="text-muted">
                      Advanced ML models for anomaly detection.
                    </p>
                  </div>

                  <div className="col-sm-4 mt-3">
                    <h4>Root Cause Analysis</h4>
                    <p className="text-muted">
                      Automated classification and risk categorization.
                    </p>
                  </div>

                  <div className="col-sm-4 mt-3">
                    <h4>Enterprise Ready</h4>
                    <p className="text-muted">
                      Built for scalability, compliance, and security.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* TEAM */}
            <section id="team" className="mt-5">
              <div className="container">
                <div className="row text-center">
                  <div className="col-md-6 col-sm-8 mx-auto">
                    <h2 className="text-primary pb-3">Our Team</h2>
                    <p className="text-muted">
                      Engineers and innovators building next-gen AI systems.
                    </p>
                  </div>
                </div>

                <div className="row mt-4 text-center">
                  <div className="col-sm-4 mt-3">
                    <img
                      src="/img/younes.jpg"
                      alt="Team Member"
                      className="img-fluid rounded-circle mb-3"
                      style={{ width: "120px", height: "120px", objectFit: "cover" }}
                    />
                    <h5>Younes Ameziane</h5>
                    <p className="text-muted">AI Engineer</p>
                  </div>

                  <div className="col-sm-4 mt-3">
                    <img
                      src="/img/margaret.jpg"
                      alt="Team Member"
                      className="img-fluid rounded-circle mb-3"
                      style={{ width: "120px", height: "120px", objectFit: "cover" }}
                    />
                    <h5>Margaret Dibor</h5>
                    <p className="text-muted">CEO and founder</p>
                  </div>

                  <div className="col-sm-4 mt-3">
                    <img
                      src="/img/jacky.jpg"
                      alt="Team Member"
                      className="img-fluid rounded-circle mb-3"
                      style={{ width: "120px", height: "120px", objectFit: "cover" }}
                    />
                    <h5>Jacky Z</h5>
                    <p className="text-muted">Cybersecurity GRC Analyst</p>
                  </div>
                </div>
                <div className="row mt-4 text-center">
                  <div className="col-sm-4 mt-3">
                    <img
                      src="/img/kimberly.jpg"
                      alt="Team Member"
                      className="img-fluid rounded-circle mb-3"
                      style={{ width: "120px", height: "120px", objectFit: "cover" }}
                    />
                    <h5>Kimberly Nnabue</h5>
                    <p className="text-muted">Business Process & Operations</p>
                  </div>

                  <div className="col-sm-4 mt-3">
                    <img
                      src="/img/saba.jpg"
                      alt="Team Member"
                      className="img-fluid rounded-circle mb-3"
                      style={{ width: "120px", height: "120px", objectFit: "cover" }}
                    />
                    <h5>Saba Sorayaei</h5>
                    <p className="text-muted">Cybersecurity Consultant</p>
                  </div>

                  <div className="col-sm-4 mt-3">
                    <img
                      src="/img/jacky.jpg"
                      alt="Team Member"
                      className="img-fluid rounded-circle mb-3"
                      style={{ width: "120px", height: "120px", objectFit: "cover" }}
                    />
                    <h5>Angelo Malimi</h5>
                    <p className="text-muted">Cybersecurity GRC Analyst</p>
                  </div>
                </div>
              </div>
            </section>

            {/* CONTACT */}
            <section className="mt-5 text-center">
              <div className="container">
                <h4>Contact Us</h4>
                <p className="text-muted mt-3">
                  Vancouver, Canada
                </p>
                <p className="text-muted">
                  info@dima-risk.ai
                </p>
              </div>
            </section>

            {/* FOOTER */}
            <section className="mt-4 text-center">
              <div className="container">
                <p className="text-muted">
                  © {new Date().getFullYear()} DIMA Risk. All Rights Reserved.
                </p>
              </div>
            </section>

          </div>
        </div>
      </div>
    </section>
  );
}
