--
-- PostgreSQL database dump
--

\restrict 6h7ce3d0QbUDa4wUhhjOn5d5eMv5xCo7jcqhQjWhT78i26b1FicbQhJlV9u84xS

-- Dumped from database version 18.3
-- Dumped by pg_dump version 18.3

-- Started on 2026-07-03 19:37:46

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 2 (class 3079 OID 33737)
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- TOC entry 5099 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- TOC entry 874 (class 1247 OID 33762)
-- Name: task_priority; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.task_priority AS ENUM (
    'low',
    'medium',
    'high'
);


ALTER TYPE public.task_priority OWNER TO postgres;

--
-- TOC entry 871 (class 1247 OID 33754)
-- Name: task_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.task_status AS ENUM (
    'pending',
    'in_progress',
    'completed'
);


ALTER TYPE public.task_status OWNER TO postgres;

--
-- TOC entry 868 (class 1247 OID 33749)
-- Name: user_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.user_role AS ENUM (
    'student',
    'admin'
);


ALTER TYPE public.user_role OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 224 (class 1259 OID 33842)
-- Name: progress; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.progress (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    subject_id uuid NOT NULL,
    completion_percentage numeric(5,2) DEFAULT 0.00,
    last_updated timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT progress_completion_percentage_check CHECK (((completion_percentage >= (0)::numeric) AND (completion_percentage <= (100)::numeric)))
);


ALTER TABLE public.progress OWNER TO postgres;

--
-- TOC entry 225 (class 1259 OID 33866)
-- Name: recommendations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.recommendations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    recommended_task_id uuid NOT NULL,
    reason text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    is_accepted boolean DEFAULT false
);


ALTER TABLE public.recommendations OWNER TO postgres;

--
-- TOC entry 223 (class 1259 OID 33822)
-- Name: study_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.study_sessions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    task_id uuid,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone,
    duration_minutes integer GENERATED ALWAYS AS ((EXTRACT(epoch FROM (end_time - start_time)) / (60)::numeric)) STORED
);


ALTER TABLE public.study_sessions OWNER TO postgres;

--
-- TOC entry 221 (class 1259 OID 33785)
-- Name: subjects; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.subjects (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    subject_name character varying(150) NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.subjects OWNER TO postgres;

--
-- TOC entry 222 (class 1259 OID 33802)
-- Name: tasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tasks (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    subject_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    due_date timestamp with time zone NOT NULL,
    priority public.task_priority DEFAULT 'medium'::public.task_priority,
    status public.task_status DEFAULT 'pending'::public.task_status,
    estimated_minutes integer,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.tasks OWNER TO postgres;

--
-- TOC entry 220 (class 1259 OID 33769)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role public.user_role DEFAULT 'student'::public.user_role,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 5092 (class 0 OID 33842)
-- Dependencies: 224
-- Data for Name: progress; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.progress (id, user_id, subject_id, completion_percentage, last_updated) FROM stdin;
\.


--
-- TOC entry 5093 (class 0 OID 33866)
-- Dependencies: 225
-- Data for Name: recommendations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.recommendations (id, user_id, recommended_task_id, reason, created_at, is_accepted) FROM stdin;
\.


--
-- TOC entry 5091 (class 0 OID 33822)
-- Dependencies: 223
-- Data for Name: study_sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.study_sessions (id, user_id, task_id, start_time, end_time) FROM stdin;
\.


--
-- TOC entry 5089 (class 0 OID 33785)
-- Dependencies: 221
-- Data for Name: subjects; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.subjects (id, user_id, subject_name, description, created_at) FROM stdin;
\.


--
-- TOC entry 5090 (class 0 OID 33802)
-- Dependencies: 222
-- Data for Name: tasks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tasks (id, subject_id, title, description, due_date, priority, status, estimated_minutes, created_at) FROM stdin;
\.


--
-- TOC entry 5088 (class 0 OID 33769)
-- Dependencies: 220
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, name, email, password_hash, role, created_at) FROM stdin;
\.


--
-- TOC entry 4928 (class 2606 OID 33853)
-- Name: progress progress_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.progress
    ADD CONSTRAINT progress_pkey PRIMARY KEY (id);


--
-- TOC entry 4932 (class 2606 OID 33879)
-- Name: recommendations recommendations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recommendations
    ADD CONSTRAINT recommendations_pkey PRIMARY KEY (id);


--
-- TOC entry 4926 (class 2606 OID 33831)
-- Name: study_sessions study_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.study_sessions
    ADD CONSTRAINT study_sessions_pkey PRIMARY KEY (id);


--
-- TOC entry 4919 (class 2606 OID 33796)
-- Name: subjects subjects_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_pkey PRIMARY KEY (id);


--
-- TOC entry 4923 (class 2606 OID 33816)
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- TOC entry 4930 (class 2606 OID 33855)
-- Name: progress unique_user_subject; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.progress
    ADD CONSTRAINT unique_user_subject UNIQUE (user_id, subject_id);


--
-- TOC entry 4914 (class 2606 OID 33784)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 4916 (class 2606 OID 33782)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 4924 (class 1259 OID 33891)
-- Name: idx_study_sessions_timeline; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_study_sessions_timeline ON public.study_sessions USING btree (user_id, start_time);


--
-- TOC entry 4917 (class 1259 OID 33893)
-- Name: idx_subjects_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_subjects_user_id ON public.subjects USING btree (user_id);


--
-- TOC entry 4920 (class 1259 OID 33892)
-- Name: idx_tasks_subject_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tasks_subject_id ON public.tasks USING btree (subject_id);


--
-- TOC entry 4921 (class 1259 OID 33890)
-- Name: idx_tasks_todo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tasks_todo ON public.tasks USING btree (status, due_date, priority) WHERE (status <> 'completed'::public.task_status);


--
-- TOC entry 4937 (class 2606 OID 33861)
-- Name: progress fk_progress_subject; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.progress
    ADD CONSTRAINT fk_progress_subject FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;


--
-- TOC entry 4938 (class 2606 OID 33856)
-- Name: progress fk_progress_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.progress
    ADD CONSTRAINT fk_progress_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4939 (class 2606 OID 33885)
-- Name: recommendations fk_recommendations_task; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recommendations
    ADD CONSTRAINT fk_recommendations_task FOREIGN KEY (recommended_task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- TOC entry 4940 (class 2606 OID 33880)
-- Name: recommendations fk_recommendations_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recommendations
    ADD CONSTRAINT fk_recommendations_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4935 (class 2606 OID 33837)
-- Name: study_sessions fk_sessions_task; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.study_sessions
    ADD CONSTRAINT fk_sessions_task FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE SET NULL;


--
-- TOC entry 4936 (class 2606 OID 33832)
-- Name: study_sessions fk_sessions_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.study_sessions
    ADD CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4933 (class 2606 OID 33797)
-- Name: subjects fk_subjects_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT fk_subjects_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4934 (class 2606 OID 33817)
-- Name: tasks fk_tasks_subject; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT fk_tasks_subject FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;


-- Completed on 2026-07-03 19:37:46

--
-- PostgreSQL database dump complete
--

\unrestrict 6h7ce3d0QbUDa4wUhhjOn5d5eMv5xCo7jcqhQjWhT78i26b1FicbQhJlV9u84xS

