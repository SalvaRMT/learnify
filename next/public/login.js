// pages/login.js
import React from 'react';
import Head from 'next/head';
import styles from '../styles/Login.module.css';

export default function Login() {
  return (
    <>
      <Head>
        <title>Login | ThikTreks</title>
        <meta name="description" content="Página de login" />
      </Head>
      <div className={styles.container}>
        <div className={styles.overlay}>
          <h1 className={styles.title}>Bienvenido</h1>
          <h2 className={styles.subtitle}>¡Ingresa para comenzar!</h2>

          <div className={styles.loginBox}>
            <h3>Acceder a tu cuenta</h3>
            <form className={styles.form}>
              <input
                type="email"
                placeholder="Enter your email address"
                className={styles.input}
              />
              <input
                type="password"
                placeholder="Enter your password"
                className={styles.input}
              />
              <button className={styles.button}>Ingresar</button>
            </form>
            <p className={styles.footerText}>
              ¿Necesitas crear una cuenta? <a href="#">Regístrate</a>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
