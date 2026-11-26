export default function Forbidden() {
  return (
    <div style={styles.error}>
      <div>
        <style dangerouslySetInnerHTML={{ __html: 'body{color:#000;background:#fff;margin:0}.next-error-h1{border-right:1px solid rgba(0,0,0,.3)}@media (prefers-color-scheme:dark){body{color:#fff;background:#000}.next-error-h1{border-right:1px solid rgba(255,255,255,.3)}}' }} />
        <h1 className="next-error-h1" style={styles.h1}>403</h1>
        <div style={styles.desc}>
          <h2 style={styles.h2}>You do not have permission to access this resource.</h2>
        </div>
      </div>
    </div>
  );
}

const styles = {
  error: {
    fontFamily: 'system-ui,"Segoe UI",Roboto,Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji"',
    height: '100vh',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  h1: {
    display: 'inline-block',
    margin: '0 20px 0 0',
    padding: '0 23px 0 0',
    fontSize: 24,
    fontWeight: 500,
    verticalAlign: 'top',
    lineHeight: '49px',
  },
  desc: {
    display: 'inline-block',
  },
  h2: {
    fontSize: 14,
    fontWeight: 400,
    lineHeight: '49px',
    margin: 0,
  },
};
