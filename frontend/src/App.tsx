
import './App.css'
import { Col, Container, Row } from 'react-bootstrap'
import CompassMap from './CompassMap'

function App() {


  return (
    <Container fluid className="px-3">
      <h2>Hornet Nest Finder</h2>
      <p>Find and report hornet nests in your area. </p>
    
      <Row className="w-100">
        <Col xs={12} className="w-100">
          <CompassMap/>
        </Col>
      </Row>
    </Container>
  )
}

export default App
