import React from 'react';
import { Result, Button } from 'antd';
import { Link } from 'react-router-dom';
import { ROUTES } from '../constants';

export const NotFoundPage: React.FC = () => {
  return (
    <Result
      status="404"
      title="404"
      subTitle="Sorry, the page you visited does not exist."
      extra={
        <Link to={ROUTES.HOME}>
          <Button type="primary">Back to Home</Button>
        </Link>
      }
    />
  );
};
