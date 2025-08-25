import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props){ super(props); this.state = { hasError:false, error:null, info:null }; }
  static getDerivedStateFromError(error){ return { hasError:true, error }; }
  componentDidCatch(error, info){ this.setState({ info }); console.error('App crashed:', error, info); }
  render(){
    if(this.state.hasError){
      return (
        <div style={{padding:20,fontFamily:'ui-sans-serif,system-ui'}}>
          <h2 style={{fontSize:20,fontWeight:700,marginBottom:8}}>Something went wrong.</h2>
          <p style={{marginBottom:12}}>If you’re seeing a blank screen, here’s the error from your browser:</p>
          <pre style={{whiteSpace:'pre-wrap',background:'#f1f5f9',padding:12,borderRadius:8}}>
{String(this.state.error)}
{this.state.info ? '\n\n'+this.state.info.componentStack : ''}
          </pre>
          <p style={{marginTop:12}}>Try refreshing. If it persists, share a screenshot of this box.</p>
        </div>
      );
    }
    return this.props.children;
  }
}